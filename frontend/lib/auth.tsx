import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useSession, signOut as nextAuthSignOut } from "next-auth/react";
import { api, setAuthToken, loadPersistedAuthToken } from "@/lib/api";
import type { AppUser } from "@/types";

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true, logout: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      // A page refresh already has a persisted backend token — reuse it
      // instead of re-hitting Google, so refreshing the dashboard doesn't
      // bounce the user back to the login screen.
      const persisted = loadPersistedAuthToken();
      if (persisted && !user) {
        try {
          const { user: me } = await api.me();
          if (!cancelled) setUser(me);
        } catch {
          setAuthToken(null);
        }
      }

      const idToken = session?.googleIdToken;
      if (status === "authenticated" && idToken && !user) {
        const { token, user: backendUser } = await api.exchangeGoogleIdToken(idToken);
        setAuthToken(token);
        if (!cancelled) setUser(backendUser);
      }

      if (!cancelled) setLoading(false);
    }

    if (status !== "loading") void sync();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

  async function logout() {
    setAuthToken(null);
    setUser(null);
    await api.logout().catch(() => undefined);
    await nextAuthSignOut({ redirect: true, callbackUrl: "/" });
  }

  return <AuthContext.Provider value={{ user, loading, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
