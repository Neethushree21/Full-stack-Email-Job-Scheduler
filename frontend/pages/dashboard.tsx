import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { Header } from "@/components/Header";
import { Tabs } from "@/components/Tabs";
import { EmailTable } from "@/components/EmailTable";
import { ComposeModal } from "@/components/ComposeModal";
import { Spinner } from "@/components/Spinner";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { ScheduledEmailDTO } from "@/types";

export default function Dashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<"scheduled" | "sent">("scheduled");
  const [scheduled, setScheduled] = useState<ScheduledEmailDTO[]>([]);
  const [sent, setSent] = useState<ScheduledEmailDTO[]>([]);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [sentTotal, setSentTotal] = useState(0);
  const [loadingTable, setLoadingTable] = useState(true);
  const [tableError, setTableError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) void router.replace("/");
  }, [authLoading, user, router]);

  useEffect(() => {
    const slackStatus = router.query.slack;
    if (slackStatus === "connected") toast.success("Slack connected — you'll get alerts when rate limits are hit.");
    if (slackStatus === "denied") toast.error("Slack connection was cancelled.");
  }, [router.query.slack]);

  const loadData = useCallback(async () => {
    setLoadingTable(true);
    setTableError(null);
    try {
      const [scheduledRes, sentRes] = await Promise.all([api.listScheduled(1, 50), api.listSent(1, 50)]);
      setScheduled(scheduledRes.items);
      setScheduledTotal(scheduledRes.total);
      setSent(sentRes.items);
      setSentTotal(sentRes.total);
    } catch (err) {
      setTableError(err instanceof Error ? err.message : "Something went wrong loading your emails.");
    } finally {
      setLoadingTable(false);
    }
  }, []);

  useEffect(() => {
    if (user) void loadData();
  }, [user, loadData]);

  // Light polling keeps the dashboard "live" without needing websockets —
  // reasonable for a scheduling dashboard where state changes on the order
  // of seconds, not milliseconds.
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => void loadData(), 10_000);
    return () => clearInterval(interval);
  }, [user, loadData]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <Header />

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-ink-800">Campaigns</h1>
            <p className="text-sm text-ink-400 mt-1">Every email your account has queued or delivered.</p>
          </div>
          <button
            onClick={() => setComposeOpen(true)}
            className="rounded-lg bg-stamp-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-stamp-600 transition-colors"
          >
            + Compose
          </button>
        </div>

        <Tabs active={tab} onChange={setTab} scheduledCount={scheduledTotal} sentCount={sentTotal} />

        <div className="mt-5">
          {tab === "scheduled" ? (
            <EmailTable
              emails={scheduled}
              loading={loadingTable}
              error={tableError}
              emptyTitle="No scheduled emails yet"
              emptySubtitle="Click Compose to upload a list of leads and schedule your first send."
              dateColumnLabel="Scheduled for"
              dateField="scheduledFor"
            />
          ) : (
            <EmailTable
              emails={sent}
              loading={loadingTable}
              error={tableError}
              emptyTitle="Nothing sent yet"
              emptySubtitle="Once scheduled emails go out, they'll show up here with their delivery time."
              dateColumnLabel="Sent at"
              dateField="sentAt"
            />
          )}
        </div>
      </div>

      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} onScheduled={loadData} />
    </div>
  );
}
