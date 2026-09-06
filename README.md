# Email Job Scheduler & Dashboard

A production-grade, cron-free email scheduling engine and dashboard. Upload a
list of leads, set a start time, a per-send delay, and an hourly cap — the
system takes it from there: queuing, throttling, rate-limiting.

```
┌────────────┐      ┌─────────────┐      ┌──────────────┐
│  Next.js   │◄────►│   Express   │◄────►│  PostgreSQL  │  source of truth
│  Dashboard │ REST │     API     │      │ (Prisma ORM) │  (every email's state)
└────────────┘      └──────┬──────┘      └──────────────┘
                            │
                     ┌──────┴──────┐      ┌──────────────┐
                     │   BullMQ    │◄────►│    Redis     │  job execution +
                     │   Worker    │      │ (AOF persist)│  rate-limit counters
                     └──────┬──────┘      └──────────────┘
                            │
                     ┌──────┴──────┐      ┌──────────────┐
                     │  Ethereal   │      │Elasticsearch │  search/filter
                     │  (fake SMTP)│      │  (mirror)    │  mirror of Postgres
                     └─────────────┘      └──────────────┘
```

## Tech stack

| Layer           | Choice                                           |
| --------------- | ------------------------------------------------ |
| Backend         | Node.js, Express, TypeScript                     |
| Database        | PostgreSQL via Prisma ORM                        |
| Queue / workers | BullMQ backed by Redis                           |
| Search          | Elasticsearch                                    |
| Email           | Nodemailer → Ethereal Email (fake SMTP)          |
| Frontend        | Next.js (Pages Router), TypeScript, Tailwind CSS |
| Auth            | Google OAuth (NextAuth) + Slack OAuth (backend)  |
| Infra           | Docker Compose (Postgres, Redis, Elasticsearch)  |

---

## Demo Flow

1. Login using Google OAuth
2. Open the dashboard
3. Click Compose
4. Enter subject and email body
5. Upload recipient CSV
6. Select start time
7. Set delay and hourly limit
8. Schedule the campaign
9. View scheduled emails
10. Wait for processing and view sent emails
11. Restart the backend
12. Refresh the dashboard and verify scheduled emails remain

## How scheduling works without cron

There is no `node-cron`, no OS crontab, no `setInterval` polling loop
anywhere in this codebase. Every scheduled send is a single **BullMQ delayed
job**:

1. When a campaign is composed, `scheduler.service.ts` computes each
   recipient's target send time as `startTime + index * effectiveDelay` and
   creates a `ScheduledEmail` row in Postgres (`status: pending`).
2. It then calls `queue.addBulk(...)`, giving each job a `delay` option equal
   to `targetTime - now` in milliseconds.
3. BullMQ stores delayed jobs in a **Redis sorted set**, scored by their due
   timestamp. A background process inside the BullMQ `Worker` (started once,
   long-lived) continuously checks "what's the earliest job whose time has
   arrived?" and moves it into the active queue. This is BullMQ's own
   event-driven scheduler — not a re-implementation of cron, and not a
   polling loop we wrote ourselves.
4. The **hourly cap is intentionally not pre-computed at schedule time.**
   Instead, every job re-checks "is there room in my sender's current hour?"
   at the moment it's actually about to run (see the rate-limiting section
   below). This makes the system self-healing: a batch scheduled today
   doesn't need to know about a batch scheduled tomorrow that happens to
   land in the same hour — each job negotiates its own slot independently,
   every time.

## How server-restart persistence is achieved

Two systems cooperate, each covering the other's blind spot:

- **Redis (BullMQ's home) is configured with `--appendonly yes`** (see
  `docker-compose.yml`). Every job add, delay, and completion is
  fsynced to disk, so a Redis container restart reloads the exact same
  waiting/delayed/active queues it had before. BullMQ workers reconnecting
  after a crash simply resume pulling from that same state — nothing needs
  to be "resubmitted."
- **PostgreSQL is the source of truth for what has actually, successfully
  been sent.** BullMQ tells you a job _ran_; only the DB tells you the SMTP
  call actually _succeeded_. On every boot, `workers/recovery.ts` runs
  before the worker starts accepting jobs:
  - Any `ScheduledEmail` stuck in `processing` for more than 5 minutes is
    assumed to belong to a worker that died mid-send, and is reset to
    `pending` so it can be safely retried by whichever job BullMQ
    redelivers for it (BullMQ's own stalled-job detection already handles
    the Redis side of that redelivery).
  - As a second safety net, any `pending` row whose BullMQ job is missing
    entirely (e.g. Redis lost data because AOF was disabled) gets a fresh
    job re-created for it. Existing, healthy jobs are left completely
    untouched.

**Duplicate-send protection** happens at the database layer, not just in
memory: before actually calling the SMTP transport, the worker runs an
atomic conditional update —

```sql
UPDATE "ScheduledEmail" SET status='processing', attempts = attempts + 1
WHERE id = $1 AND status IN ('pending', 'failed')
```

If zero rows update, another attempt already claimed this email and the job
exits as a no-op. Deliberately, a row sitting in `processing` is **not**
claimable — so if a worker dies between sending the SMTP request and writing
`sent` to the DB, we do not automatically re-send it (that would risk a real
duplicate). It only becomes claimable again once the 5-minute staleness
check above resets it, which is a safe assumption specifically _because_ we
know it never reached `sent`.

> **Honest caveat:** true exactly-once delivery across a network boundary
> (our server ↔ the SMTP provider) is a well-known hard problem without
> provider-side idempotency keys, which Ethereal doesn't offer. What's
> implemented here is at-least-once delivery with a narrow, explicitly
> reasoned-about duplicate window (a crash in the few milliseconds between
> "SMTP accepted the message" and "Postgres write committed") — which is the
> same tradeoff every real-world transactional email pipeline without
> provider idempotency support has to make.

## How rate limiting and concurrency are safely handled

**Concurrency (`WORKER_CONCURRENCY`).** A single BullMQ `Worker` processes up
to `WORKER_CONCURRENCY` jobs in parallel (in-process, via BullMQ's internal
scheduler — not separate OS threads). Every shared piece of state the
processor touches (the hourly counter, the throttle clock, the DB claim) is
mutated through **atomic Redis/SQL operations**, never read-then-write in
application code, so it is safe regardless of how many jobs run in parallel
or how many worker processes/replicas you scale out to.

**Minimum send delay (throttling).** A naive "check `now - lastSentAt`"
implementation races under concurrency — two parallel jobs can both read the
same `lastSentAt` and both think they're clear to send immediately. Instead,
`throttle.service.ts` hands out **virtual time slots** using a Redis Lua
script (`GET` + `SET` execute as one atomic operation):

```
nextAllowed = GET(key) or now
mySlot      = max(nextAllowed, now)
SET(key, mySlot + minDelay)
return mySlot
```

Every concurrent caller for the same sender gets a distinct, strictly
increasing slot spaced exactly `minDelay` apart — verified directly against
a live Redis instance with 10 concurrent callers producing 10 collision-free,
evenly-spaced slots (see "Verification" below). If a job's slot is in the
future, the worker calls `job.moveToDelayed(slot, token)` and throws BullMQ's
`DelayedError` — the job is rescheduled, not failed, and doesn't consume a
retry attempt.

**Hourly rate limiting.** Counters live in Redis, namespaced per sender and
per hour bucket (`ratelimit:count:{senderId}:{YYYY-MM-DDTHH}`), so they're
shared correctly across every worker process and survive restarts (the
bucket itself naturally "resets" every hour by virtue of being a new key).
Each job calls `INCR` — atomic and race-free even under heavy parallelism —
and if the result exceeds the sender's limit, immediately `DECR`s to give the
slot back (so the counter always reflects real sends, never phantom
reservations).

**When the limit is hit, the job is never dropped.** It's pushed into the
next hour, and — to avoid a thundering herd of thousands of jobs all landing
on the exact same millisecond at the top of the next hour — each overflowed
job gets a fanned-out position via a second atomic counter
(`ratelimit:overflow:{senderId}:{hour}`), placed at
`nextHourStart + (position - 1) * minSendDelay`. Order is preserved because
positions are handed out via atomic `INCR` in the same order jobs are
processed; if that next hour is _also_ full (e.g. a huge backlog), the same
check simply cascades the job forward again when it's eventually
reprocessed. A Slack alert fires the moment a sender's cap is hit (see
below); if that sender's send volume genuinely can't fit in a single hour,
the dashboard will show it steadily draining across consecutive hours rather
than emails disappearing.

## Slack alerts & graceful degradation

`slack.service.ts` posts to the user's incoming webhook the moment their
hourly cap is reached. If the user never connected Slack (no
`SlackIntegration` row), or the webhook call throws for any reason, it's
logged and swallowed — a missing/broken notification integration can never
take down the send pipeline itself.

## Live queue visibility

Bull-Board is mounted at **`/admin/queues`** on the backend
(`http://localhost:4000/admin/queues`), giving a real-time view into every
job's waiting / delayed / active / completed / failed state directly from
Redis — the fastest way to _see_ the overflow-cascade behavior above in
action.

## Load: 1,000+ emails scheduled for the same second

- **Enqueuing is O(1) round trips, not O(n).** `scheduleEmailBatch` uses
  `queue.addBulk(...)`, a single Redis pipeline call for the entire batch,
  regardless of whether it's 10 or 10,000 recipients.
- **No job blocks another.** Each recipient is its own independent BullMQ
  job with its own delay; there's no shared in-memory loop iterating over
  "all pending emails" that could become a bottleneck or a single point of
  failure.
- **The hourly counter is what actually throttles throughput**, not queue
  insertion — 1,000 jobs landing in the same second will all enqueue
  instantly, then drain at whatever rate `WORKER_CONCURRENCY`,
  `MIN_SEND_DELAY_MS`, and the hourly cap allow, safely spilling excess into
  subsequent hours via the overflow cascade rather than erroring or
  dropping anything.

---

## Project structure

```
email-scheduler/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── config/        # env, redis, postgres (prisma), elasticsearch
│       ├── controllers/   # auth, slack, email HTTP handlers
│       ├── middlewares/   # JWT auth guard, error handler
│       ├── queues/        # BullMQ queue definition + Bull-Board mount
│       ├── routes/
│       ├── services/      # rate limiter, throttle, email, slack, search, scheduler
│       ├── workers/       # the BullMQ processor + startup recovery
│       ├── types/
│       ├── app.ts
│       └── server.ts
└── frontend/
    ├── components/        # Header, Tabs, ComposeModal, EmailTable, etc.
    ├── lib/                # api client, auth context, CSV parser
    ├── pages/
    │   ├── index.tsx       # Google sign-in
    │   ├── dashboard.tsx   # Scheduled/Sent tabs + Compose
    │   └── api/auth/[...nextauth].ts
    └── types/
```

---

## Running it

### Option A — Docker Compose (everything at once)

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
# fill in GOOGLE_CLIENT_ID/SECRET and SLACK_CLIENT_ID/SECRET in both files

docker compose up --build
```

- Dashboard: http://localhost:3000
- API: http://localhost:4000
- Bull-Board: http://localhost:4000/admin/queues

### Option B — Local development

Requires Postgres, Redis, and Elasticsearch running locally (or point the
`.env` files at hosted versions of each).

```bash
# Backend
cd backend
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, OAuth creds
npm install
npx prisma migrate deploy   # applies the included migration
npm run dev                 # http://localhost:4000

# Frontend (separate terminal)
cd frontend
cp .env.local.example .env.local   # fill in GOOGLE_CLIENT_ID/SECRET, NEXTAUTH_SECRET
npm install
npm run dev                 # http://localhost:3000
```

### Google & Slack OAuth setup

- **Google**: create an OAuth Client ID (Web application) in the [Google
  Cloud Console](https://console.cloud.google.com/apis/credentials).
  Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`.
  Use the **same** client ID/secret in both `backend/.env` and
  `frontend/.env.local` — the frontend runs the consent flow, the backend
  independently verifies the resulting ID token.
- **Slack**: create an app at [api.slack.com/apps](https://api.slack.com/apps)
  with the `incoming-webhook` and `chat:write` scopes. Redirect URL:
  `http://localhost:4000/api/slack/callback`.

---

## Verification performed

Because this environment's
package registries only (no Docker Hub, no `binaries.prisma.sh`), the
following was verified directly rather than assumed:

- ✅ Real PostgreSQL 16 and Redis 7 installed and run in this environment;
  the hand-written Prisma migration was applied against a live database and
  produces the exact expected schema (verified with `\d`).
- ✅ The rate limiter and throttle services were exercised against a live
  Redis instance with real concurrent load (`Promise.all` of 50 parallel
  hourly-limit checks and 10 parallel throttle reservations): the hourly
  cap admitted **exactly** the configured limit with zero over-admits, the
  Redis counter read back the exact expected value (proving the give-back
  `DECR` path works), overflowed jobs received strictly increasing,
  correctly-spaced timestamps landing exactly on the next hour boundary,
  and all 10 concurrent throttle reservations produced distinct,
  collision-free, evenly-spaced slots.
- ✅ Backend type-checks cleanly with `tsc --noEmit`, except for two
  `@prisma/client` generated-type errors that only exist because `prisma
generate` couldn't download its query-engine binary from
  `binaries.prisma.sh` inside this sandbox (that domain isn't reachable
  here). This resolves itself the moment `npx prisma generate` runs
  anywhere with normal internet access — including the provided Dockerfile,
  which runs it automatically during the image build.
- ✅ Frontend builds cleanly end-to-end with Next.js (`npm run build`),
  including type-checking, linting, and static page generation.
