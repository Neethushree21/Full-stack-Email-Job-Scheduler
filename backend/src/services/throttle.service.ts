import { redis } from "../config/redis";

/**
 * Enforces "at least `minDelayMs` between any two sends for this sender".
 *
 * A naive implementation ("read lastSentAt, compare to now") races under
 * concurrency: two workers can both read the same lastSentAt and both
 * decide they're clear to send immediately. Instead we atomically hand out
 * *virtual slots* using a Lua script (GET+SET happen as one Redis
 * operation, so concurrent callers can never collide):
 *
 *   nextAllowed = GET(key) or now
 *   mySlot      = max(nextAllowed, now)
 *   SET(key, mySlot + minDelayMs)
 *   return mySlot
 *
 * Every concurrent caller gets a distinct, strictly increasing slot spaced
 * exactly minDelayMs apart, with zero cross-process race window.
 */
const SLOT_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local minDelay = tonumber(ARGV[2])
local ttlSeconds = tonumber(ARGV[3])

local nextAllowed = tonumber(redis.call('GET', key))
local slot
if not nextAllowed or nextAllowed < now then
  slot = now
else
  slot = nextAllowed
end

redis.call('SET', key, slot + minDelay, 'EX', ttlSeconds)
return slot
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const redisWithCommands = redis as any;
if (!redisWithCommands.throttleSlot) {
  redis.defineCommand("throttleSlot", { numberOfKeys: 1, lua: SLOT_LUA });
}

/**
 * Reserves this sender's next available send slot and returns the
 * timestamp (ms epoch) at which sending is allowed. If the returned value
 * is <= Date.now(), the caller may send immediately; otherwise it must wait
 * (in our worker, that means moving the BullMQ job to `delayed` until then).
 */
export async function reserveThrottleSlot(senderId: string, minDelayMs: number): Promise<number> {
  const key = `throttle:nextslot:${senderId}`;
  const ttlSeconds = Math.max(60, Math.ceil((minDelayMs * 2) / 1000));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slot = await (redis as any).throttleSlot(key, Date.now(), minDelayMs, ttlSeconds);
  return Number(slot);
}
