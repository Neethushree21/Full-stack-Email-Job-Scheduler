import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";
import { logger } from "../utils/logger";

let transporterPromise: Promise<Transporter> | null = null;

/**
 * Ethereal is a throwaway SMTP sandbox: nothing ever reaches a real inbox,
 * but nodemailer gets a real SMTP round-trip and Ethereal gives back a
 * preview URL for every message, which is what makes it useful for demoing
 * a "sent" state end-to-end. If credentials aren't supplied in .env, we
 * mint a fresh disposable test account automatically on first use.
 */
async function getTransporter(): Promise<Transporter> {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      let user = env.ETHEREAL_USER;
      let pass = env.ETHEREAL_PASS;

      if (!user || !pass) {
        const testAccount = await nodemailer.createTestAccount();
        user = testAccount.user;
        pass = testAccount.pass;
        logger.info({ user }, "Generated a throwaway Ethereal test account (set ETHEREAL_USER/PASS to pin one)");
      }

      return nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user, pass },
      });
    })();
  }
  return transporterPromise;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: input.from ?? '"Email Scheduler" <scheduler@example.com>',
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  return {
    messageId: info.messageId,
    previewUrl: nodemailer.getTestMessageUrl(info),
  };
}
