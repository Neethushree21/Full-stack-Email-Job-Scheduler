import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function Header() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
  }

  return (
    <header className="border-b border-ink-100 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-stamp-500 flex items-center justify-center text-white text-xs font-bold font-mono">
            ES
          </div>
          <span className="font-semibold text-ink-800">Email Scheduler</span>
        </div>

        <div className="flex items-center gap-4">
          <a
            href={api.connectSlackUrl()}
            className="text-sm font-medium text-ink-500 hover:text-ink-800 border border-ink-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            Connect Slack
          </a>

          {user && (
            <div className="flex items-center gap-3 border-l border-ink-100 pl-4">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt={user.name} className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-ink-100 flex items-center justify-center text-xs font-medium text-ink-500">
                  {user.name?.[0]?.toUpperCase()}
                </div>
              )}
              <div className="hidden sm:block leading-tight">
                <p className="text-sm font-medium text-ink-800">{user.name}</p>
                <p className="text-xs text-ink-400">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="text-sm font-medium text-ink-400 hover:text-rust-500 transition-colors disabled:opacity-50"
              >
                {loggingOut ? "Signing out…" : "Log out"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
