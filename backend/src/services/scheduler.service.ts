import { prisma } from "../config/prisma";
import { emailQueue } from "../queues/email.queue";
import { env, maxEmailsPerHourFor } from "../config/env";
import { addSeconds } from "../utils/time";
import { indexEmailDocument } from "./search.service";
import type { ComposeEmailRequest, ComposeEmailResponse, EmailJobData } from "../types";

/**
 * Turns one "Compose" submission into:
 *   1. An EmailBatch row (for dashboard grouping/context).
 *   2. One ScheduledEmail row per recipient (source of truth, status='pending').
 *   3. One BullMQ delayed job per recipient (the actual execution vehicle).
 *
 * No cron job is ever created. Each email's initial `scheduledFor` is simply
 * `startTime + index * effectiveDelay`, and BullMQ's native `delay` option
 * (a per-job entry in a Redis sorted set, checked by the worker's event
 * loop — not an OS timer or repeating schedule) is what fires it at that
 * moment. The *hourly cap* is intentionally NOT pre-computed here: it is
 * re-checked by the worker at the moment each job is about to run (see
 * email.worker.ts). That makes the system self-healing — if 1,000 emails
 * land in the same hour, or new batches are scheduled later into an
 * already-busy hour, every job independently negotiates its own slot at
 * send time instead of relying on a single up-front calculation that could
 * go stale.
 */
export async function scheduleEmailBatch(userId: string, req: ComposeEmailRequest): Promise<ComposeEmailResponse> {
  const senderId = req.senderId?.trim() || userId;
  const startTime = new Date(req.startTime);
  // The env var is a hard floor ("provider throttling"); the user's chosen
  // delay may only ever be equal to or larger than it.
  const effectiveDelayMs = Math.max(req.delaySeconds * 1000, env.MIN_SEND_DELAY_MS);
  // The user's requested cap may only ever tighten, never loosen, the
  // tenant-level ceiling configured for this sender in .env.
  const effectiveHourlyLimit = Math.min(req.hourlyLimit, maxEmailsPerHourFor(senderId));

  const batch = await prisma.emailBatch.create({
    data: {
      userId,
      senderId,
      subject: req.subject,
      body: req.body,
      startTime,
      delaySeconds: Math.round(effectiveDelayMs / 1000),
      hourlyLimit: effectiveHourlyLimit,
      totalRecipients: req.recipients.length,
    },
  });

  const scheduledEmails = await Promise.all(
    req.recipients.map((recipient, index) =>
      prisma.scheduledEmail.create({
        data: {
          batchId: batch.id,
          userId,
          senderId,
          recipientEmail: recipient.email,
          subject: req.subject,
          body: req.body,
          sequence: index,
          scheduledFor: addSeconds(startTime, Math.round((index * effectiveDelayMs) / 1000)),
          status: "pending",
        },
      })
    )
  );

  // addBulk is a single round trip to Redis for all N jobs — this is what
  // lets "1,000+ emails scheduled for the exact same second" stay fast:
  // it's O(1) network calls, not O(N).
  const jobs = await emailQueue.addBulk(
    scheduledEmails.map((email) => ({
      name: "send-email",
      data: {
        scheduledEmailId: email.id,
        senderId: email.senderId,
        recipientEmail: email.recipientEmail,
        subject: email.subject,
        body: email.body,
        sequence: email.sequence,
        minSendDelayMs: effectiveDelayMs,
        hourlyLimit: effectiveHourlyLimit,
        userId,
      } satisfies EmailJobData,
      opts: {
        delay: Math.max(0, email.scheduledFor.getTime() - Date.now()),
        jobId: email.id, // reuse our own id as the BullMQ job id: makes recovery lookups trivial
      },
    }))
  );

  // Persist the BullMQ job id back onto each row and mirror into
  // Elasticsearch for search — done after enqueueing so a failure here
  // never risks losing the job itself.
  await Promise.all(
    scheduledEmails.map(async (email, i) => {
      const updated = await prisma.scheduledEmail.update({
        where: { id: email.id },
        data: { bullJobId: jobs[i].id },
      });
      await indexEmailDocument(updated);
    })
  );

  const sorted = [...scheduledEmails].sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());

  return {
    batchId: batch.id,
    totalRecipients: scheduledEmails.length,
    firstScheduledFor: sorted[0].scheduledFor.toISOString(),
    lastScheduledFor: sorted[sorted.length - 1].scheduledFor.toISOString(),
  };
}
