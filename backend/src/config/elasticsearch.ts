import { Client } from "@elastic/elasticsearch";
import { env } from "./env";
import { logger } from "../utils/logger";

export const esClient = new Client({ node: env.ELASTICSEARCH_NODE });

/**
 * Idempotent index bootstrap. Safe to call on every boot: `exists` + create
 * means a restart never wipes previously indexed documents.
 */
export async function ensureEmailIndex(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: env.ELASTICSEARCH_INDEX });
    if (exists) return;

    await esClient.indices.create({
      index: env.ELASTICSEARCH_INDEX,
      mappings: {
        properties: {
          id: { type: "keyword" },
          batchId: { type: "keyword" },
          userId: { type: "keyword" },
          senderId: { type: "keyword" },
          recipientEmail: { type: "keyword" },
          subject: { type: "text" },
          body: { type: "text" },
          status: { type: "keyword" },
          scheduledFor: { type: "date" },
          sentAt: { type: "date" },
          createdAt: { type: "date" },
        },
      },
    });
    logger.info({ index: env.ELASTICSEARCH_INDEX }, "Created Elasticsearch index");
  } catch (err) {
    // Elasticsearch is used for search/filter UX, not as the system of
    // record — Postgres is. So we log and continue rather than crash the
    // whole API if ES is temporarily unreachable.
    logger.error({ err }, "Failed to ensure Elasticsearch index (search will be degraded)");
  }
}
