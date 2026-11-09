import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import type { BookDonation } from "../models/BookDonation.js";

const sender = "info@indianheritager.com";
const officeAddress =
  "250, East Periyar Nagar, Ramanathapuram, Coimbatore, Tamil Nadu - 641045.";

type EmailStatus = {
  status: "sent" | "failed" | "not_configured" | "disabled";
  messageId: string;
  error: string;
  sentAt?: Date;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character]!;
  });
}

export function buildBookDonationMessage(donation: {
  donor: { fullName: string; email: string };
  deliveryMethod: string;
}) {
  const name = donation.donor.fullName;
  const safeName = escapeHtml(name);
  const address = escapeHtml(officeAddress);

  if (donation.deliveryMethod === "courier") {
    return {
      subject: "Book Donation – Confirmation & Courier Instructions | Indian Heritager",
      text: `Dear ${name},\n\nGreetings from Indian Heritager!\n\nThank you for supporting education and knowledge sharing with your generous book donation. We have received your request and noted your choice to courier the books.\n\nNext steps:\n1. Pack the books securely and ensure they are in good, usable condition.\n2. Courier them to Indian Heritager, ${officeAddress}\n3. Reply to this email with the courier service provider, AWB/tracking number, dispatch date, and a photograph or scan of the courier receipt/booking proof.\n\nOur team will acknowledge the dispatch and update you after the books are received.\n\nWarm regards,\nTeam Indian Heritager\n${sender}\nhttps://indianheritager.org/`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#242424;max-width:640px;margin:auto"><p>Dear ${safeName},</p><p>Greetings from Indian Heritager!</p><p>Thank you for supporting education and knowledge sharing with your generous book donation. We have received your request and noted your choice to courier the books.</p><h2 style="font-size:18px">Next steps – courier delivery</h2><ol><li>Pack the books securely and ensure they are in good, usable condition.</li><li>Courier them to <strong>Indian Heritager</strong>, ${address}</li><li>Reply to this email with the courier service provider, AWB/tracking number, dispatch date, and a photograph or scan of the courier receipt/booking proof.</li></ol><p>Our team will acknowledge the dispatch and update you after the books are received.</p><p>Warm regards,<br><strong>Team Indian Heritager</strong><br><a href="mailto:${sender}">${sender}</a><br><a href="https://indianheritager.org/">indianheritager.org</a></p></div>`,
    };
  }

  return {
    subject: "Book Donation – Delivery Scheduling Confirmation | Indian Heritager",
    text: `Dear ${name},\n\nGreetings from Indian Heritager!\n\nThank you for your interest in donating books and supporting our initiative. We have received your request and noted that you plan to personally deliver the books to our office.\n\nPlease reply to this email with your proposed delivery date, expected time of arrival, and approximate number of books. Kindly wait for our team's confirmation before visiting so we can arrange to receive your contribution.\n\nOffice address: Indian Heritager, ${officeAddress}\n\nPlease ensure that the books are in good, usable condition. We look forward to receiving your contribution.\n\nWarm regards,\nTeam Indian Heritager\n${sender}\nhttps://indianheritager.org/`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#242424;max-width:640px;margin:auto"><p>Dear ${safeName},</p><p>Greetings from Indian Heritager!</p><p>Thank you for your interest in donating books and supporting our initiative. We have received your request and noted that you plan to personally deliver the books to our office.</p><h2 style="font-size:18px">Next steps – schedule your visit</h2><p>Please reply to this email with your proposed delivery date, expected time of arrival, and approximate number of books. Kindly wait for our team's confirmation before visiting so we can arrange to receive your contribution.</p><h2 style="font-size:18px">Office address</h2><p><strong>Indian Heritager</strong><br>${address}</p><p>Please ensure that the books are in good, usable condition. We look forward to receiving your contribution.</p><p>Warm regards,<br><strong>Team Indian Heritager</strong><br><a href="mailto:${sender}">${sender}</a><br><a href="https://indianheritager.org/">indianheritager.org</a></p></div>`,
  };
}

function createTransporter() {
  return nodemailer.createTransport({
    host: env.email.host,
    port: env.email.port,
    secure: env.email.secure,
    auth: { user: env.email.user, pass: env.email.password },
  });
}

export async function verifyBookDonationEmailTransport(): Promise<void> {
  if (!(env.email.host && env.email.user && env.email.password)) {
    throw new Error("SMTP_HOST, SMTP_USER, and SMTP_PASSWORD must be configured");
  }
  await createTransporter().verify();
}

export async function sendBookDonationConfirmation(
  donation: Pick<InstanceType<typeof BookDonation>, "_id" | "donor" | "deliveryMethod">,
): Promise<EmailStatus> {
  if (!env.email.enabled) {
    return { status: "disabled", messageId: "", error: "Automated email is disabled" };
  }

  if (!(env.email.host && env.email.user && env.email.password)) {
    console.error("[email] Book donation confirmation not sent: SMTP is not configured");
    return { status: "not_configured", messageId: "", error: "SMTP is not configured" };
  }

  if (!donation.donor?.fullName || !donation.donor.email) {
    const error = "Book donation is missing a donor name or email address";
    console.error(`[email] ${error}`, String(donation._id));
    return { status: "failed", messageId: "", error };
  }
  const message = buildBookDonationMessage({
    donor: { fullName: donation.donor.fullName, email: donation.donor.email },
    deliveryMethod: donation.deliveryMethod ?? "",
  });
  try {
    const transporter = createTransporter();
    const result = await transporter.sendMail({
      from: sender,
      replyTo: sender,
      to: donation.donor.email,
      subject: message.subject,
      text: message.text,
      html: message.html,
      headers: { "X-Donation-Id": String(donation._id) },
    });
    return {
      status: "sent",
      messageId: result.messageId,
      error: "",
      sentAt: new Date(),
    };
  } catch (error) {
    console.error("[email] Book donation confirmation delivery failed", error);
    return {
      status: "failed",
      messageId: "",
      error: error instanceof Error ? error.message.slice(0, 500) : "Email delivery failed",
    };
  }
}
