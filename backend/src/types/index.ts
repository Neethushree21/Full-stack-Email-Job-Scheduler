import { EmailStatus } from "@prisma/client";

export interface AuthenticatedUser {
  id: string;
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface ComposeRecipient {
  email: string;
}

export interface ComposeEmailRequest {
  subject: string;
  body: string;
  recipients: ComposeRecipient[];
  startTime: string; // ISO datetime
  delaySeconds: number;
  hourlyLimit: number;
  senderId?: string; // defaults to the authenticated user's id (multi-tenant key)
}

export interface ComposeEmailResponse {
  batchId: string;
  totalRecipients: number;
  firstScheduledFor: string;
  lastScheduledFor: string;
}

export interface ScheduledEmailDTO {
  id: string;
  batchId: string;
  recipientEmail: string;
  subject: string;
  scheduledFor: string;
  sentAt: string | null;
  status: EmailStatus;
  attempts: number;
  errorMessage: string | null;
}

export interface EmailJobData {
  scheduledEmailId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  sequence: number;
  minSendDelayMs: number;
  hourlyLimit: number;
  userId: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
