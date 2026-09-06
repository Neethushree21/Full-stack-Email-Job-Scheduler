import { Response, NextFunction } from "express";
import { z } from "zod";
import { EmailStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { scheduleEmailBatch } from "../services/scheduler.service";
import { searchEmails } from "../services/search.service";
import { HttpError } from "../middlewares/error.middleware";
import type { AuthedRequest } from "../middlewares/auth.middleware";

// Prisma's generated `{ in: EmailStatus[] }` filter wants a mutable array.
// `as const` produces a readonly tuple, which TypeScript will NOT accept
// there even though the values are identical — so this list is declared
// once, with an explicit mutable EmailStatus[] type, and reused.
const UNSENT_STATUSES: EmailStatus[] = ["pending", "processing", "failed"];

const composeSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  recipients: z
    .array(z.object({ email: z.string().email() }))
    .min(1, "At least one recipient is required"),
  startTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
  delaySeconds: z.coerce.number().min(0).max(3600),
  hourlyLimit: z.coerce.number().min(1).max(100000),
  senderId: z.string().optional(),
});

export async function scheduleEmails(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new HttpError(401, "Not authenticated");
    const payload = composeSchema.parse(req.body);
    const result = await scheduleEmailBatch(req.user.id, payload);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export async function listScheduled(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new HttpError(401, "Not authenticated");
    const { page, pageSize } = listQuerySchema.parse(req.query);

    const where = { userId: req.user.id, status: { in: UNSENT_STATUSES } };
    const [items, total] = await Promise.all([
      prisma.scheduledEmail.findMany({
        where,
        orderBy: { scheduledFor: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.scheduledEmail.count({ where }),
    ]);

    res.json({ items, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

export async function listSent(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new HttpError(401, "Not authenticated");
    const { page, pageSize } = listQuerySchema.parse(req.query);

    const where = { userId: req.user.id, status: "sent" as const };
    const [items, total] = await Promise.all([
      prisma.scheduledEmail.findMany({
        where,
        orderBy: { sentAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.scheduledEmail.count({ where }),
    ]);

    res.json({ items, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

const searchQuerySchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export async function search(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new HttpError(401, "Not authenticated");
    const { q, status, page, pageSize } = searchQuerySchema.parse(req.query);
    const result = await searchEmails({
      userId: req.user.id,
      query: q,
      status,
      page,
      pageSize,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}
