import { Worker, Job, DelayedError } from "bullmq";
import { createRedisConnection } from "../config/redis";
import { EMAIL_QUEUE_NAME } from "../queues/email.queue";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { logger } from "../utils/logger";
import { sendEmail } from "../services/email.service";
import { indexEmailDocument } from "../services/search.service";
import { tryConsumeHourlySlot, computeOverflowTarget } from "../services/rateLimiter.service";
import { reserveThrottleSlot } from "../services/throttle.service";
import { notifySlackRateLimitHit } from "../services/slack.service";
import type { EmailJobData } from "../types";

/**
 * This function is intentionally the ONLY place that decides "can this
 * email go out right now?". Every recipient's job — whether it's running
 * for the first time or being re-delivered after a crash — passes through
 * exactly this same gate, which is what keeps the throttle and hourly cap
 * correct no matter how or when a job gets (re)processed.
 */
async function processEmailJob(job: Job<EmailJobData>, token: string | undefined): Promise<void> {
  const data = job.data;

  const record = await prisma.scheduledEmail.findUnique({ where: { id: data.scheduledEmailId } });
  if (!record) {
    logger.warn({ id: data.scheduledEmailId }, "ScheduledEmail row no longer exists — dropping job");
    return;
  }

  // Idempotency guard #1: if a previous run already got this all the way to
  // 'sent' (e.g. this job was redelivered after being marked stalled, but
  // actually completed just before the worker process died), do nothing.
  if (record.status === "sent") {
    logger.info({ id: record.id }, "Email already sent — skipping duplicate delivery");
    return;
  }

  // --- 1. Hourly rate limit -------------------------------------------------
  const slot = await tryConsumeHourlySlot(data.senderId, data.hourlyLimit);
  if (!slot.allowed) {
    const newTarget = await computeOverflowTarget(data.senderId, new Date(), data.minSendDelayMs);

    await prisma.scheduledEmail.update({
      where: { id: record.id },
      data: { scheduledFor: newTarget, status: "pending" },
    });

    logger.warn(
      { senderId: data.senderId, bucket: slot.bucket, limit: slot.limit, pushedTo: newTarget.toISOString() },
      "Hourly limit reached — rescheduling job to next available window (order preserved)"
    );

    void notifySlackRateLimitHit({
      userId: data.userId,
      senderId: data.senderId,
      bucket: slot.bucket,
      limit: slot.limit,
      pushedToHour: newTarget.toISOString(),
    });

    if (token) {
      await job.moveToDelayed(newTarget.getTime(), token);
      throw new DelayedError();
    }
    return;
  }

  // --- 2. Minimum send delay (provider throttling) --------------------------
  const slotTimestamp = await reserveThrottleSlot(data.senderId, data.minSendDelayMs);
  if (slotTimestamp > Date.now()) {
    if (token) {
      await job.moveToDelayed(slotTimestamp, token);
      throw new DelayedError();
    }
    return;
  }

  // --- 3. Atomic claim: only a row still in pending/failed can be sent ------
  // Excluding 'processing' here is deliberate: if a previous attempt died
  // between sending the SMTP request and writing 'sent' to the DB, we do
  // NOT retry it automatically (that would risk a duplicate send). A
  // startup reconciliation job (see recovery.ts) is what safely unsticks
  // genuinely-crashed 'processing' rows after a staleness timeout.
  const claim = await prisma.scheduledEmail.updateMany({
    where: { id: record.id, status: { in: ["pending", "failed"] } },
    data: { status: "processing", attempts: { increment: 1 } },
  });

  if (claim.count === 0) {
    logger.info({ id: record.id }, "Row already claimed by another attempt — skipping");
    return;
  }

  try {
    const result = await sendEmail({ to: record.recipientEmail, subject: record.subject, html: record.body });

    const updated = await prisma.scheduledEmail.update({
      where: { id: record.id },
      data: { status: "sent", sentAt: new Date(), errorMessage: null },
    });

    logger.info({ id: record.id, previewUrl: result.previewUrl }, "Email sent");
    await indexEmailDocument(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown send error";
    const updated = await prisma.scheduledEmail.update({
      where: { id: record.id },
      data: { status: "failed", errorMessage: message },
    });
    await indexEmailDocument(updated);
    // Re-throw so BullMQ applies its own attempts/backoff policy on top.
    throw err;
  }
}

export function startEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: createRedisConnection(),
    concurrency: env.WORKER_CONCURRENCY,
    // Generous lock so a slow-but-alive worker isn't mistaken for stalled
    // mid-send; renewed automatically by BullMQ while the job is active.
    lockDuration: 60_000,
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "Job failed");
  });
  worker.on("error", (err) => {
    logger.error({ err }, "Worker error");
  });

  return worker;
}
