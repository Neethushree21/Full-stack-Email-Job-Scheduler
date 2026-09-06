import type { EmailStatus } from "@/types";

const STYLES: Record<EmailStatus, string> = {
  pending: "bg-ink-50 text-ink-500 border-ink-200",
  processing: "bg-stamp-50 text-stamp-600 border-stamp-200",
  sent: "bg-sea-50 text-sea-600 border-sea-100",
  failed: "bg-rust-50 text-rust-500 border-rust-500/20",
};

const LABELS: Record<EmailStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  sent: "Sent",
  failed: "Failed",
};

export function StatusBadge({ status }: { status: EmailStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium font-mono ${STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[status]}
    </span>
  );
}
