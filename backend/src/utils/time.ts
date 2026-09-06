/**
 * All rate-limit accounting is bucketed by calendar hour (UTC), keyed as
 * "YYYY-MM-DDTHH". This keeps the Redis key naturally self-expiring (via a
 * TTL set on first write) and makes "push to the next available hour"
 * trivial: it's just `bucketStart + 1h`.
 */
export function hourBucketKey(date: Date): string {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString().slice(0, 13); // e.g. 2026-09-06T14
}

export function hourBucketStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

export function nextHourBoundary(date: Date): Date {
  const start = hourBucketStart(date);
  return new Date(start.getTime() + 60 * 60 * 1000);
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}
