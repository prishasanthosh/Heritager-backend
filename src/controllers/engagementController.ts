import type { Request, Response } from "express";
import { z } from "zod";
import { ContactMessage } from "../models/ContactMessage.js";
import { VolunteerApplication } from "../models/VolunteerApplication.js";
import { NewsletterSubscriber } from "../models/NewsletterSubscriber.js";
import { asyncHandler, ApiError } from "../utils/asyncHandler.js";
import { parseVolunteerFields, saveVolunteerApplication } from "../utils/volunteer.js";

// --- Contact ---

const contactSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  subject: z.string().min(2).max(150),
  message: z.string().min(5).max(1000),
});

export const submitContact = asyncHandler(async (req: Request, res: Response) => {
  const data = contactSchema.parse(req.body);
  const contactMessage = await ContactMessage.create(data);
  res.status(201).json({ message: "Message received", contactMessage });
});

export const listContactMessages = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  const messages = await ContactMessage.find(filter).sort({ createdAt: -1 });
  res.json({ messages });
});

const statusSchema = z.object({ status: z.enum(["new", "read", "resolved"]) });

export const updateContactStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = statusSchema.parse(req.body);
  const msg = await ContactMessage.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!msg) throw new ApiError(404, "Message not found");
  res.json({ contactMessage: msg });
});

// --- Volunteer ---

export const submitVolunteerApplication = asyncHandler(async (req: Request, res: Response) => {
  const fields = parseVolunteerFields(req.body);
  const existing = await VolunteerApplication.exists({ email: fields.email });
  const application = await saveVolunteerApplication(fields, "standalone");
  res.status(existing ? 200 : 201).json({ message: "Application received", application });
});

export const listVolunteerApplications = asyncHandler(async (req: Request, res: Response) => {
  const { status, source, q } = z
    .object({
      status: z.enum(["new", "contacted", "onboarded", "declined"]).optional(),
      source: z.enum(["standalone", "book_donation", "book_purchase"]).optional(),
      q: z.string().trim().max(120).optional(),
    })
    .parse(req.query);
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (source) filter.registrationSource = source;
  if (q?.trim()) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
      { phone: { $regex: escaped, $options: "i" } },
    ];
  }
  const applications = await VolunteerApplication.find(filter)
    .populate("bookDonation", "donor book deliveryMethod createdAt")
    .populate("order", "total status paymentStatus createdAt")
    .sort({ createdAt: -1 });
  res.json({ applications });
});

const volunteerStatusSchema = z.object({ status: z.enum(["new", "contacted", "onboarded", "declined"]) });

export const updateVolunteerStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = volunteerStatusSchema.parse(req.body);
  const application = await VolunteerApplication.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!application) throw new ApiError(404, "Application not found");
  res.json({ application });
});

// --- Newsletter ---

const newsletterSchema = z.object({ email: z.string().email() });

export const subscribeNewsletter = asyncHandler(async (req: Request, res: Response) => {
  const { email } = newsletterSchema.parse(req.body);
  await NewsletterSubscriber.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $set: { email: email.toLowerCase(), status: "subscribed" } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({ message: "Subscribed" });
});

export const listNewsletterSubscribers = asyncHandler(async (_req: Request, res: Response) => {
  const subscribers = await NewsletterSubscriber.find().sort({ createdAt: -1 }).lean();
  res.json({
    subscribers: subscribers.map((subscriber) => ({
      ...subscriber,
      status: subscriber.status ?? "subscribed",
    })),
  });
});

const newsletterStatusSchema = z.object({ status: z.enum(["subscribed", "unsubscribed"]) });

export const updateNewsletterSubscriberStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = newsletterStatusSchema.parse(req.body);
  const subscriber = await NewsletterSubscriber.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  );
  if (!subscriber) throw new ApiError(404, "Newsletter subscriber not found");
  res.json({ subscriber });
});
