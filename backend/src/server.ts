import { env } from "./config/env";
import { logger } from "./utils/logger";
import { createApp } from "./app";
import { ensureEmailIndex } from "./config/elasticsearch";
import { runStartupRecovery } from "./workers/recovery";
import { startEmailWorker } from "./workers/email.worker";

async function main(): Promise<void> {
  // Order matters here: reconcile DB/BullMQ state for anything left over
  // from a previous crash BEFORE the worker starts pulling new jobs, so we
  // never race a fresh job against an unresolved stale one.
  await runStartupRecovery();
  await ensureEmailIndex();

  const worker = startEmailWorker();
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 API listening on http://localhost:${env.PORT}`);
    logger.info(`📊 Bull-Board dashboard at http://localhost:${env.PORT}/admin/queues`);
  });

  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, "Shutting down gracefully…");
    server.close();
    // Let in-flight jobs finish their current step instead of yanking the
    // connection mid-send, which is what would otherwise create a
    // duplicate-send risk on the very next boot.
    await worker.close();
    process.exit(0);
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "Fatal error during startup");
  process.exit(1);
});
