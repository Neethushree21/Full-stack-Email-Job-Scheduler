import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { AuthenticatedUser } from "../types";

export interface AuthedRequest extends Request {
  user?: AuthenticatedUser;
}

interface SchedulerJwtPayload extends AuthenticatedUser {
  iat: number;
  exp: number;
}

/**
 * Our own short-lived session JWT (issued after we verify the Google ID
 * token server-side) — kept separate from Google's token so the frontend
 * never has to re-run the Google flow just to call our API.
 */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const cookieToken = req.cookies?.[env.SESSION_COOKIE_NAME];
  const token = header?.startsWith("Bearer ") ? header.slice(7) : cookieToken;

  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as SchedulerJwtPayload;
    req.user = {
      id: payload.id,
      googleId: payload.googleId,
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.avatarUrl,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}
