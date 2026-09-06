interface TabsProps {
  active: "scheduled" | "sent";
  onChange: (tab: "scheduled" | "sent") => void;
  scheduledCount?: number;
  sentCount?: number;
}

export function Tabs({ active, onChange, scheduledCount, sentCount }: TabsProps) {
  const tabs: { key: "scheduled" | "sent"; label: string; count?: number }[] = [
    { key: "scheduled", label: "Scheduled Emails", count: scheduledCount },
    { key: "sent", label: "Sent Emails", count: sentCount },
  ];

  return (
    <div className="flex gap-1 border-b border-ink-100">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            active === tab.key
              ? "border-stamp-500 text-ink-800"
              : "border-transparent text-ink-400 hover:text-ink-600"
          }`}
        >
          {tab.label}
          {typeof tab.count === "number" && (
            <span className="ml-2 rounded-full bg-ink-50 px-1.5 py-0.5 text-xs font-mono text-ink-400">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
