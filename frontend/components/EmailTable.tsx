import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import type { ScheduledEmailDTO } from "@/types";

interface EmailTableProps {
  emails: ScheduledEmailDTO[];
  loading: boolean;
  error: string | null;
  emptyTitle: string;
  emptySubtitle: string;
  dateColumnLabel: "Scheduled for" | "Sent at";
  dateField: "scheduledFor" | "sentAt";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EmailTable({
  emails,
  loading,
  error,
  emptyTitle,
  emptySubtitle,
  dateColumnLabel,
  dateField,
}: EmailTableProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Spinner />
        <p className="text-sm text-ink-400">Loading emails…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rust-500/20 bg-rust-50 p-6 text-center">
        <p className="text-sm font-medium text-rust-500">Couldn&apos;t load emails</p>
        <p className="mt-1 text-xs text-rust-500/80">{error}</p>
      </div>
    );
  }

  if (emails.length === 0) {
    return <EmptyState title={emptyTitle} subtitle={emptySubtitle} />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-ink-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 bg-ink-50/60 text-left text-xs uppercase tracking-wide text-ink-400">
            <th className="px-4 py-3 font-medium">Recipient</th>
            <th className="px-4 py-3 font-medium">Subject</th>
            <th className="px-4 py-3 font-medium">{dateColumnLabel}</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Attempts</th>
          </tr>
        </thead>
        <tbody>
          {emails.map((email) => (
            <tr key={email.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/40">
              <td className="px-4 py-3 font-mono text-ink-700">{email.recipientEmail}</td>
              <td className="px-4 py-3 text-ink-600 max-w-xs truncate">{email.subject}</td>
              <td className="px-4 py-3 text-ink-500 font-mono text-xs">{formatDate(email[dateField])}</td>
              <td className="px-4 py-3">
                <StatusBadge status={email.status} />
                {email.status === "failed" && email.errorMessage && (
                  <p className="mt-1 text-xs text-rust-500 max-w-[16rem] truncate" title={email.errorMessage}>
                    {email.errorMessage}
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-ink-500 font-mono">{email.attempts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
