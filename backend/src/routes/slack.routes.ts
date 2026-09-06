import { Router } from "express";
import { connectSlack, slackCallback } from "../controllers/slack.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const slackRouter = Router();

slackRouter.get("/connect", requireAuth, connectSlack);
// Slack redirects the browser here directly — no Authorization header, see
// controller comment for how identity is carried through via `state`.
slackRouter.get("/callback", slackCallback);
