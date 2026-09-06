export type EmailStatus = "pending" | "processing" | "sent" | "failed";

export interface AppUser {
  id: string;
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
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

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ComposePayload {
  subject: string;
  body: string;
  recipients: { email: string }[];
  startTime: string;
  delaySeconds: number;
  hourlyLimit: number;
}

export interface ComposeResponse {
  batchId: string;
  totalRecipients: number;
  firstScheduledFor: string;
  lastScheduledFor: string;
}
