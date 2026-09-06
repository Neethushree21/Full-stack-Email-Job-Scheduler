import { Response, NextFunction } from "express";
import { Request } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { buildSlackAuthorizeUrl, exchangeSlackCode, saveSlackIntegration } from "../services/slack.service";
import { HttpError } from "../middlewares/error.middleware";
import type { AuthedRequest } from "../middlewares/auth.middleware";

/**
 * Slack's redirect-based OAuth means the callback arrives as a bare GET
 * request from Slack's servers, not from our own authenticated frontend
 * fetch — so we can't rely on an Authorization header at that point. We
 * carry the user's identity through the flow in a short-lived, signed
 * `state` token instead (the standard OAuth CSRF-state pattern, repurposed
 * to also carry identity).
 */
export function connectSlack(req: AuthedRequest, res: Response): void {
  if (!req.user) throw new HttpError(401, "Not authenticated");
  const state = jwt.sign({ userId: req.user.id }, env.JWT_SECRET, { expiresIn: "10m" });
  res.redirect(buildSlackAuthorizeUrl(state));
}

export async function slackCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

    if (error) {
      return res.redirect(`${env.FRONTEND_URL}/dashboard?slack=denied`);
    }
    if (!code || !state) throw new HttpError(400, "Missing code/state from Slack");

    const { userId } = jwt.verify(state, env.JWT_SECRET) as { userId: string };

    const oauth = await exchangeSlackCode(code);
    await saveSlackIntegration(userId, oauth);

    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
  } catch (err) {
    next(err);
  }
}
