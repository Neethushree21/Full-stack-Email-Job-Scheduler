import { esClient } from "../config/elasticsearch";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import type { ScheduledEmail } from "@prisma/client";

/**
 * Elasticsearch is a read-optimized mirror of ScheduledEmail rows, used
 * purely for fast subject/body full-text search and filtering in the
 * dashboard. Postgres remains the source of truth — if an index write here
 * fails, we log and move on rather than fail the send/schedule pipeline.
 */
export async function indexEmailDocument(email: ScheduledEmail): Promise<void> {
  try {
    await esClient.index({
      index: env.ELASTICSEARCH_INDEX,
      id: email.id,
      document: {
        id: email.id,
        batchId: email.batchId,
        userId: email.userId,
        senderId: email.senderId,
        recipientEmail: email.recipientEmail,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledFor: email.scheduledFor,
        sentAt: email.sentAt,
        createdAt: email.createdAt,
      },
    });
  } catch (err) {
    logger.error({ err, emailId: email.id }, "Failed to index email in Elasticsearch");
  }
}

export interface SearchEmailsParams {
  userId: string;
  query?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function searchEmails(params: SearchEmailsParams) {
  const { userId, query, status, page = 1, pageSize = 20 } = params;

  const filter: Record<string, unknown>[] = [{ term: { userId } }];
  if (status) filter.push({ term: { status } });

  const must = query
    ? [{ multi_match: { query, fields: ["subject", "body", "recipientEmail"] } }]
    : [{ match_all: {} }];

  const result = await esClient.search({
    index: env.ELASTICSEARCH_INDEX,
    from: (page - 1) * pageSize,
    size: pageSize,
    sort: [{ scheduledFor: { order: "desc" } }],
    query: { bool: { must, filter } },
  });

  return {
    total: typeof result.hits.total === "number" ? result.hits.total : result.hits.total?.value ?? 0,
    items: result.hits.hits.map((hit) => hit._source),
  };
}
