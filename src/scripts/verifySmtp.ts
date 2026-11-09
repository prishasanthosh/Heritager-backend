import { verifyBookDonationEmailTransport } from "../services/bookDonationEmail.js";

verifyBookDonationEmailTransport()
  .then(() => console.log("[email] SMTP transport verified; no email was sent"))
  .catch((error: unknown) => {
    console.error("[email] SMTP verification failed", error);
    process.exitCode = 1;
  });
