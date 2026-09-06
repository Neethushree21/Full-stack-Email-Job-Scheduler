import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { emailQueue } from "./email.queue";

/**
 * Exposes a live, real-time view of every job's state (waiting / delayed /
 * active / completed / failed) straight from Redis — this is how an
 * operator inspects the "N emails delayed until next hour" behavior
 * without querying Postgres or grepping logs.
 */
export function mountBullBoard(basePath: string) {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(basePath);

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
  });

  return serverAdapter.getRouter();
}
