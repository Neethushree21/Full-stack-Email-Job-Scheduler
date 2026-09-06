import express, { Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { apiRouter } from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { mountBullBoard } from "./queues/bull-board";

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use(pinoHttp({ logger }));

  // Live BullMQ dashboard — see queues/bull-board.ts
  app.use("/admin/queues", mountBullBoard("/admin/queues"));

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
