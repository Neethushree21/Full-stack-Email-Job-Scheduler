import { Router } from "express";
import { scheduleEmails, listScheduled, listSent, search } from "../controllers/email.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const emailRouter = Router();

emailRouter.use(requireAuth);
emailRouter.post("/schedule", scheduleEmails);
emailRouter.get("/scheduled", listScheduled);
emailRouter.get("/sent", listSent);
emailRouter.get("/search", search);
