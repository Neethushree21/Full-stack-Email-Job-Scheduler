import { PrismaClient } from "@prisma/client";

// A single PrismaClient instance per process. Prisma manages its own
// connection pool internally, so this is safe to share across controllers,
// services and the BullMQ worker running in the same process.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
