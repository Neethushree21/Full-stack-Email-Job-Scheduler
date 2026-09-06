import "dotenv/config";
import { z } from "zod";

/**
 * A single, validated source of truth for every environment variable the
 * app relies on. Failing fast here (instead of getting `undefined` deep
 * inside a worker) is what keeps a crash-restart cycle predictable.
 */
const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(8, "JWT_SECRET must be set to a long random string"),
  SESSION_COOKIE_NAME: z.string().default("ejs_session"),

  DATABASE_URL: z.string(),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(""),

  ELASTICSEARCH_NODE: z.string().default("http://localhost:9200"),
  ELASTICSEARCH_INDEX: z.string().default("emails"),

  WORKER_CONCURRENCY: z.coerce.number().default(5),
  MIN_SEND_DELAY_MS: z.coerce.number().default(2000),
  DEFAULT_MAX_EMAILS_PER_HOUR: z.coerce.number().default(200),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.string().default("{}"),

  ETHEREAL_USER: z.string().optional().default(""),
  ETHEREAL_PASS: z.string().optional().default(""),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),

  SLACK_CLIENT_ID: z.string().optional().default(""),
  SLACK_CLIENT_SECRET: z.string().optional().default(""),
  SLACK_REDIRECT_URI: z.string().optional().default("http://localhost:4000/api/slack/callback"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast and loud: a misconfigured worker that silently no-ops the
  // rate limiter is far worse than a process that refuses to boot.
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

function parsePerSenderLimits(raw: string): Record<string, number> {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") return obj as Record<string, number>;
    return {};
  } catch {
    return {};
  }
}

export const env = {
  ...parsed.data,
  perSenderHourlyLimits: parsePerSenderLimits(parsed.data.MAX_EMAILS_PER_HOUR_PER_SENDER),
};

export function maxEmailsPerHourFor(senderId: string): number {
  return env.perSenderHourlyLimits[senderId] ?? env.DEFAULT_MAX_EMAILS_PER_HOUR;
}
