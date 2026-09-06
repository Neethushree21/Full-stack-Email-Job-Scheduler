import { Router } from "express";
import { authRouter } from "./auth.routes";
import { slackRouter } from "./slack.routes";
import { emailRouter } from "./email.routes";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));
apiRouter.use("/auth", authRouter);
apiRouter.use("/slack", slackRouter);
apiRouter.use("/emails", emailRouter);
