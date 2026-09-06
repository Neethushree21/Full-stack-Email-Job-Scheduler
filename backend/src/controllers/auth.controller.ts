import { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { HttpError } from "../middlewares/error.middleware";
import type { AuthedRequest } from "../middlewares/auth.middleware";

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

const googleLoginSchema = z.object({
  idToken: z.string().min(10),
});

/**
 * The frontend runs the real Google OAuth consent flow (via NextAuth) and
 * hands us the resulting Google ID token. We independently verify that
 * token's signature and audience with Google here — the backend never
 * trusts a client-asserted identity — then upsert the user and mint our
 * own short-lived session JWT.
 */
export async function googleLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { idToken } = googleLoginSchema.parse(req.body);

    const ticket = await googleClient.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      throw new HttpError(401, "Invalid Google token");
    }

    const user = await prisma.user.upsert({
      where: { googleId: payload.sub },
      create: {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name ?? payload.email,
        avatarUrl: payload.picture,
      },
      update: {
        email: payload.email,
        name: payload.name ?? payload.email,
        avatarUrl: payload.picture,
      },
    });

    const sessionToken = jwt.sign(
      { id: user.id, googleId: user.googleId, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
      env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie(env.SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ token: sessionToken, user });
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthedRequest, res: Response): Promise<void> {
  res.json({ user: req.user });
}

export async function logout(req: Request, res: Response): Promise<void> {
  res.clearCookie(env.SESSION_COOKIE_NAME);
  res.json({ ok: true });
}
