import { Queue } from "bullmq";
import { createRedisConnection } from "../config/redis";
import type { EmailJobData } from "../types";

export const EMAIL_QUEUE_NAME = "email-send";

/**
 * A dedicated connection for the Queue instance (separate from the shared
 * `redis` client used for counters) — BullMQ recommends this so blocking
 * commands used internally never contend with your own app's Redis calls.
 */
export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    // Keep a rolling window of history for observability in Bull-Board
    // without letting Redis grow unbounded.
    removeOnComplete: { age: 24 * 60 * 60, count: 5000 },
    removeOnFail: { age: 7 * 24 * 60 * 60 },
  },
});
