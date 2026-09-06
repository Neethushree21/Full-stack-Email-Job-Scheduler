import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import "@/styles/globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <AuthProvider>
        <main className={`${plexSans.variable} ${plexMono.variable} font-sans`}>
          <Component {...pageProps} />
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: "#161A2B", color: "#FAF8F4", fontSize: "0.875rem" },
              success: { iconTheme: { primary: "#3D6E68", secondary: "#FAF8F4" } },
              error: { iconTheme: { primary: "#A63D33", secondary: "#FAF8F4" } },
            }}
          />
        </main>
      </AuthProvider>
    </SessionProvider>
  );
}
