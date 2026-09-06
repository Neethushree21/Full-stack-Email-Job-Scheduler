import { Router } from "express";
import { googleLogin, me, logout } from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const authRouter = Router();

authRouter.post("/google", googleLogin);
authRouter.get("/me", requireAuth, me);
authRouter.post("/logout", logout);
