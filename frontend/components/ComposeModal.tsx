import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { parseLeadsFile } from "@/lib/csvParser";
import { api } from "@/lib/api";
import { Spinner } from "@/components/Spinner";

interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  onScheduled: () => void;
}

function defaultStartTime(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
  d.setSeconds(0, 0);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function ComposeModal({ open, onClose, onScheduled }: ComposeModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [emails, setEmails] = useState<string[]>([]);
  const [invalidRows, setInvalidRows] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleFile(file: File) {
    setParsing(true);
    setFileName(file.name);
    try {
      const { emails: parsed, invalidRows: invalid } = await parseLeadsFile(file);
      setEmails(parsed);
      setInvalidRows(invalid);
      if (parsed.length === 0) {
        toast.error("No valid email addresses found in that file.");
      }
    } catch {
      toast.error("Couldn't parse that file. Please upload a CSV or plain text file.");
      setEmails([]);
    } finally {
      setParsing(false);
    }
  }

  function reset() {
    setSubject("");
    setBody("");
    setFileName(null);
    setEmails([]);
    setInvalidRows(0);
    setStartTime(defaultStartTime());
    setDelaySeconds(2);
    setHourlyLimit(200);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!subject.trim()) return toast.error("Subject is required.");
    if (!body.trim()) return toast.error("Email body is required.");
    if (emails.length === 0) return toast.error("Upload a leads file with at least one valid email address.");

    setSubmitting(true);
    try {
      const result = await api.scheduleEmails({
        subject,
        body,
        recipients: emails.map((email) => ({ email })),
        startTime: new Date(startTime).toISOString(),
        delaySeconds,
        hourlyLimit,
      });
      toast.success(`Scheduled ${result.totalRecipients} emails.`);
      reset();
      onScheduled();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to schedule emails.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-panel">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-ink-800">Compose campaign</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Q3 product update for our early customers"
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stamp-200 focus:border-stamp-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">Email body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Hi there, ..."
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stamp-200 focus:border-stamp-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">Leads file (CSV or .txt)</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                Choose file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && void handleFile(e.target.files[0])}
              />
              {fileName && <span className="text-sm text-ink-500 truncate max-w-[16rem]">{fileName}</span>}
            </div>

            {parsing && (
              <div className="mt-2 flex items-center gap-2 text-sm text-ink-400">
                <Spinner className="h-4 w-4" /> Parsing file…
              </div>
            )}
            {!parsing && fileName && (
              <p className="mt-2 text-sm text-ink-500">
                Detected <span className="font-semibold text-sea-600 font-mono">{emails.length}</span> valid email
                address{emails.length === 1 ? "" : "es"}
                {invalidRows > 0 && <span className="text-rust-500"> · {invalidRows} rows skipped</span>}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">Start time</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stamp-200 focus:border-stamp-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">Delay (seconds)</label>
              <input
                type="number"
                min={0}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stamp-200 focus:border-stamp-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">Hourly limit</label>
              <input
                type="number"
                min={1}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stamp-200 focus:border-stamp-400"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-ink-100 px-6 py-4">
          <button onClick={onClose} className="text-sm font-medium text-ink-500 hover:text-ink-800 px-3 py-2">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-stamp-500 px-4 py-2 text-sm font-medium text-white hover:bg-stamp-600 disabled:opacity-60 transition-colors"
          >
            {submitting && <Spinner className="h-4 w-4 text-white" />}
            {submitting ? "Scheduling…" : `Schedule ${emails.length || ""} email${emails.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
