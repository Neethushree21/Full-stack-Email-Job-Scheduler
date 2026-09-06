import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    // Google's raw ID token is what our Express backend independently
    // verifies (see backend/src/controllers/auth.controller.ts). We stash
    // it on the NextAuth JWT so it survives across requests without a
    // second round-trip to Google.
    async jwt({ token, account }) {
      if (account?.id_token) {
        token.googleIdToken = account.id_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.googleIdToken = token.googleIdToken;
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};

export default NextAuth(authOptions);
