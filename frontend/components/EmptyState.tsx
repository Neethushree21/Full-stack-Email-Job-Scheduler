import { ReactNode } from "react";

export function EmptyState({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-12 w-12 rounded-full bg-ink-50 flex items-center justify-center text-ink-300 mb-4">
        {icon ?? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 7l9 6 9-6M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <p className="font-medium text-ink-700">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-ink-400 max-w-sm">{subtitle}</p>}
    </div>
  );
}
