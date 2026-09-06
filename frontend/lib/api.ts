import axios, { AxiosInstance } from "axios";
import type { ComposePayload, ComposeResponse, PaginatedResponse, ScheduledEmailDTO, AppUser } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

let authToken: string | null = null;

/** Called once after Google sign-in completes and the backend session JWT is issued. */
export function setAuthToken(token: string | null): void {
  authToken = token;
  if (typeof window !== "undefined") {
    if (token) sessionStorage.setItem("ejs_token", token);
    else sessionStorage.removeItem("ejs_token");
  }
}

export function loadPersistedAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  authToken = sessionStorage.getItem("ejs_token");
  return authToken;
}

function client(): AxiosInstance {
  return axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });
}

export const api = {
  async exchangeGoogleIdToken(idToken: string): Promise<{ token: string; user: AppUser }> {
    const { data } = await client().post("/api/auth/google", { idToken });
    return data;
  },

  async me(): Promise<{ user: AppUser }> {
    const { data } = await client().get("/api/auth/me");
    return data;
  },

  async logout(): Promise<void> {
    await client().post("/api/auth/logout");
  },

  connectSlackUrl(): string {
    return `${API_URL}/api/slack/connect`;
  },

  async scheduleEmails(payload: ComposePayload): Promise<ComposeResponse> {
    const { data } = await client().post("/api/emails/schedule", payload);
    return data;
  },

  async listScheduled(page = 1, pageSize = 20): Promise<PaginatedResponse<ScheduledEmailDTO>> {
    const { data } = await client().get("/api/emails/scheduled", { params: { page, pageSize } });
    return data;
  },

  async listSent(page = 1, pageSize = 20): Promise<PaginatedResponse<ScheduledEmailDTO>> {
    const { data } = await client().get("/api/emails/sent", { params: { page, pageSize } });
    return data;
  },

  async search(query: string, status?: string, page = 1, pageSize = 20) {
    const { data } = await client().get("/api/emails/search", { params: { q: query, status, page, pageSize } });
    return data;
  },
};
