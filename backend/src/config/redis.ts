import IORedis, { Redis } from "ioredis";
import { env } from "./env";
import { logger } from "../utils/logger";

/**
 * BullMQ requires `maxRetriesPerRequest: null` on any connection it manages
 * so that it can handle reconnects itself (this is the #1 cause of "jobs
 * silently stop processing after a restart" bugs in BullMQ setups).
 */
export function createRedisConnection(): Redis {
  const connection = new IORedis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  connection.on("error", (err) => logger.error({ err }, "Redis connection error"));
  connection.on("connect", () => logger.info("Redis connected"));

  return connection;
}

// A single shared connection for general-purpose reads/writes (rate limit
// counters, throttle locks). BullMQ Queue/Worker instances get their own
// dedicated connections elsewhere since they multiplex blocking commands.
export const redis = createRedisConnection();
