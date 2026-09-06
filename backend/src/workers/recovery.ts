import { prisma } from "../config/prisma";
import { emailQueue } from "../queues/email.queue";
import { logger } from "../utils/logger";

// If a row has been stuck in 'processing' for longer than this, we treat the
// worker that claimed it as dead (crashed before it could write a final
// status) and safely return it to the pool. BullMQ's own stalled-job check
// (default ~30s) will already have redelivered the underlying job to a
// live worker by the time this runs on boot, so unsticking the DB claim
// here is what lets that redelivered job actually go through.
const STALE_PROCESSING_MINUTES = 5;

/**
 * Runs once, on every process boot (including after a crash). This is what
 * makes the "future scheduled emails must still send at the correct time,
 * and Day-1 emails must never be re-sent or restarted" requirement actually
 * hold in practice — Redis/BullMQ alone tell you what jobs exist, but only
 * the DB tells you what has truly, successfully gone out.
 */
export async function runStartupRecovery(): Promise<void> {
  const staleCutoff = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60 * 1000);

  const unstuck = await prisma.scheduledEmail.updateMany({
    where: { status: "processing", updatedAt: { lt: staleCutoff } },
    data: { status: "pending" },
  });
  if (unstuck.count > 0) {
    logger.warn({ count: unstuck.count }, "Recovered stale 'processing' rows back to 'pending' after restart");
  }

  // Belt-and-suspenders: if Redis itself lost data (e.g. it was never
  // configured with persistence and the container recycled), a 'pending'
  // row might have no corresponding BullMQ job left at all. Re-create it so
  // it isn't silently stranded forever. Existing jobs are left completely
  // untouched — this only fills genuine gaps.
  const pendingRows = await prisma.scheduledEmail.findMany({
    where: { status: "pending" },
    select: {
      id: true,
      bullJobId: true,
      senderId: true,
      recipientEmail: true,
      subject: true,
      body: true,
      sequence: true,
      scheduledFor: true,
      userId: true,
      batch: { select: { delaySeconds: true, hourlyLimit: true } },
    },
  });

  let requeued = 0;
  for (const row of pendingRows) {
    const existingJob = row.bullJobId ? await emailQueue.getJob(row.bullJobId) : undefined;
    if (existingJob) continue; // job is still tracked by BullMQ — nothing to do

    const job = await emailQueue.add(
      "send-email",
      {
        scheduledEmailId: row.id,
        senderId: row.senderId,
        recipientEmail: row.recipientEmail,
        subject: row.subject,
        body: row.body,
        sequence: row.sequence,
        minSendDelayMs: row.batch.delaySeconds * 1000,
        hourlyLimit: row.batch.hourlyLimit,
        userId: row.userId,
      },
      {
        delay: Math.max(0, row.scheduledFor.getTime() - Date.now()),
        jobId: row.id,
      }
    );
    await prisma.scheduledEmail.update({ where: { id: row.id }, data: { bullJobId: job.id } });
    requeued++;
  }

  if (requeued > 0) {
    logger.warn({ count: requeued }, "Re-created BullMQ jobs missing for pending rows after restart");
  }

  logger.info("Startup recovery complete");
}
