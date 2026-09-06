import { redis } from "../config/redis";
import { hourBucketKey, hourBucketStart, nextHourBoundary } from "../utils/time";

/**
 * All counters live in Redis (never in process memory) so that:
 *  - multiple worker processes/replicas share one accurate count, and
 *  - a server restart doesn't reset "how many have already gone out this hour".
 *
 * Keys are namespaced per sender, so a multi-tenant deployment enforces
 * MAX_EMAILS_PER_HOUR_PER_SENDER independently for every sender identity.
 */

const COUNTER_TTL_SECONDS = 2 * 60 * 60; // survives well past the bucket's own hour, then self-cleans
const OVERFLOW_TTL_SECONDS = 2 * 60 * 60;

export interface SlotResult {
  allowed: boolean;
  bucket: string;
  count: number;
  limit: number;
}

/**
 * Atomically attempts to reserve one send inside the given sender's current
 * hourly bucket. Uses INCR (atomic, race-free even with N concurrent
 * workers) and immediately gives the slot back with DECR if it turns out we
 * went over the limit — so the counter always reflects real sends only.
 */
export async function tryConsumeHourlySlot(
  senderId: string,
  maxPerHour: number,
  at: Date = new Date()
): Promise<SlotResult> {
  const bucket = hourBucketKey(at);
  const key = `ratelimit:count:${senderId}:${bucket}`;

  const count = await redis.incr(key);
  // NX: only the very first writer for this bucket sets the expiry, but it's
  // harmless/idempotent if called every time since NX no-ops when TTL exists.
  await redis.expire(key, COUNTER_TTL_SECONDS, "NX");

  if (count > maxPerHour) {
    await redis.decr(key); // we're not actually going to send — give the slot back
    return { allowed: false, bucket, count: count - 1, limit: maxPerHour };
  }

  return { allowed: true, bucket, count, limit: maxPerHour };
}

/**
 * Returns this job's 1-indexed position among everything that has overflowed
 * OUT of `fromBucket` for this sender so far. Used to fan overflowed jobs
 * out across the next hour (spaced by the min send delay) instead of
 * slamming all of them onto the exact same millisecond at the top of the
 * next hour.
 */
export async function nextOverflowPosition(senderId: string, fromBucket: string): Promise<number> {
  const key = `ratelimit:overflow:${senderId}:${fromBucket}`;
  const position = await redis.incr(key);
  await redis.expire(key, OVERFLOW_TTL_SECONDS, "NX");
  return position;
}

/**
 * Computes where an over-the-limit job should be pushed to: the start of
 * the next hour, offset by its overflow position * the min send delay. If
 * that offset itself would spill past the hour it lands in, the job will
 * simply re-trigger this same cascade again when it's eventually processed
 * — so it keeps rolling forward hour by hour until it finds room.
 */
export async function computeOverflowTarget(
  senderId: string,
  currentTarget: Date,
  minSendDelayMs: number
): Promise<Date> {
  const bucket = hourBucketKey(currentTarget);
  const position = await nextOverflowPosition(senderId, bucket);
  const nextHourStart = nextHourBoundary(currentTarget);
  return new Date(nextHourStart.getTime() + (position - 1) * minSendDelayMs);
}

export function currentHourBucketStart(at: Date = new Date()): Date {
  return hourBucketStart(at);
}
