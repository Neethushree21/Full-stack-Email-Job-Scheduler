import { useEffect } from "react";
import { useRouter } from "next/router";
import { signIn } from "next-auth/react";
import { useAuth } from "@/lib/auth";

function MailPathMotif() {
  return (
    <svg viewBox="0 0 480 360" fill="none" className="w-full max-w-md" aria-hidden="true">
      <circle cx="90" cy="280" r="4" fill="#B5622A" />
      <circle cx="240" cy="60" r="4" fill="#3D6E68" />
      <circle cx="410" cy="220" r="4" fill="#B5622A" />
      <path
        d="M90 280 C 150 180, 180 120, 240 60"
        stroke="#C7CBDA"
        strokeWidth="1.5"
        strokeDasharray="4 6"
        fill="none"
      />
      <path
        d="M240 60 C 300 110, 340 160, 410 220"
        stroke="#C7CBDA"
        strokeWidth="1.5"
        strokeDasharray="4 6"
        fill="none"
      />
      <rect x="60" y="255" width="60" height="42" rx="4" stroke="#161A2B" strokeWidth="1.5" fill="#FAF8F4" />
      <path d="M60 259 L90 280 L120 259" stroke="#161A2B" strokeWidth="1.5" fill="none" />
      <rect x="210" y="35" width="60" height="42" rx="4" stroke="#161A2B" strokeWidth="1.5" fill="#FAF8F4" />
      <path d="M210 39 L240 60 L270 39" stroke="#161A2B" strokeWidth="1.5" fill="none" />
      <rect x="380" y="195" width="60" height="42" rx="4" stroke="#161A2B" strokeWidth="1.5" fill="#FAF8F4" />
      <path d="M380 199 L410 220 L440 199" stroke="#161A2B" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) void router.replace("/dashboard");
  }, [loading, user, router]);

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <div className="flex-1 grid lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-between p-12 bg-ink-800 text-paper">
          <div>
            <p className="font-mono text-xs tracking-wide text-ink-300">email scheduler & dashboard</p>
            <h1 className="mt-6 text-4xl font-semibold leading-tight">
              Send at scale,
              <br />
              on your terms.
            </h1>
            <p className="mt-4 text-ink-200 max-w-sm">
              Queue thousands of emails, respect every provider limit, and watch each one move from pending to sent
              — no cron jobs anywhere in the pipeline.
            </p>
          </div>
          <MailPathMotif />
        </div>

        <div className="flex items-center justify-center p-8">
          <div className="w-full max-w-sm">
            <div className="lg:hidden mb-8">
              <p className="font-mono text-xs tracking-wide text-ink-400">email scheduler & dashboard</p>
            </div>

            <div className="bg-white border border-ink-100 rounded-xl shadow-panel p-8">
              <h2 className="text-xl font-semibold text-ink-800">Sign in</h2>
              <p className="mt-1 text-sm text-ink-400">Use your Google account to access your dashboard.</p>

              <button
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                className="mt-6 w-full flex items-center justify-center gap-3 rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-800 hover:bg-ink-50 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path
                    fill="#FFC107"
                    d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
                  />
                  <path
                    fill="#FF3D00"
                    d="M6.3 14.7l6.6 4.8C14.7 15.9 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
                  />
                  <path
                    fill="#4CAF50"
                    d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.1-11.3-7.6l-6.5 5C9.5 39.6 16.2 44 24 44z"
                  />
                  <path
                    fill="#1976D2"
                    d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C40.9 36.5 44 30.8 44 24c0-1.3-.1-2.7-.4-3.5z"
                  />
                </svg>
                Continue with Google
              </button>

              <p className="mt-6 text-xs text-ink-300 leading-relaxed">
                This uses a real Google OAuth consent flow. We only read your name, email and profile photo to show
                in the dashboard header.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
