import axios from "axios";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { logger } from "../utils/logger";

export function buildSlackAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: "incoming-webhook,chat:write",
    redirect_uri: env.SLACK_REDIRECT_URI,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

interface SlackOAuthResponse {
  ok: boolean;
  access_token: string;
  team: { id: string; name: string };
  incoming_webhook?: { channel: string; channel_id: string; url: string };
  error?: string;
}

export async function exchangeSlackCode(code: string): Promise<SlackOAuthResponse> {
  const { data } = await axios.post<SlackOAuthResponse>(
    "https://slack.com/api/oauth.v2.access",
    new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_REDIRECT_URI,
    })
  );
  if (!data.ok) {
    throw new Error(`Slack OAuth exchange failed: ${data.error ?? "unknown_error"}`);
  }
  return data;
}

export async function saveSlackIntegration(userId: string, oauth: SlackOAuthResponse): Promise<void> {
  await prisma.slackIntegration.upsert({
    where: { userId },
    create: {
      userId,
      teamId: oauth.team.id,
      teamName: oauth.team.name,
      accessToken: oauth.access_token,
      webhookUrl: oauth.incoming_webhook?.url,
      channelId: oauth.incoming_webhook?.channel_id,
    },
    update: {
      teamId: oauth.team.id,
      teamName: oauth.team.name,
      accessToken: oauth.access_token,
      webhookUrl: oauth.incoming_webhook?.url,
      channelId: oauth.incoming_webhook?.channel_id,
    },
  });
}

/**
 * Fires a live alert to the user's connected Slack workspace when their
 * hourly send limit is hit. This is best-effort: if the user never
 * connected Slack, or the webhook call fails, we log it and move on — a
 * missing notification integration must never take down the send pipeline.
 */
export async function notifySlackRateLimitHit(params: {
  userId: string;
  senderId: string;
  bucket: string;
  limit: number;
  pushedToHour: string;
}): Promise<void> {
  try {
    const integration = await prisma.slackIntegration.findUnique({ where: { userId: params.userId } });

    if (!integration?.webhookUrl) {
      logger.warn(
        { userId: params.userId, senderId: params.senderId, limit: params.limit },
        "Hourly rate limit hit but no Slack integration connected — logging only"
      );
      return;
    }

    await axios.post(integration.webhookUrl, {
      text:
        `:rotating_light: *Hourly send limit reached*\n` +
        `Sender \`${params.senderId}\` hit its cap of *${params.limit}/hr* during window \`${params.bucket}\`.\n` +
        `Remaining emails have been automatically rescheduled to \`${params.pushedToHour}\` — nothing was dropped.`,
    });
  } catch (err) {
    logger.error({ err, userId: params.userId }, "Failed to deliver Slack rate-limit alert (continuing anyway)");
  }
}
