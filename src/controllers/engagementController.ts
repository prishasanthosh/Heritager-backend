import type { Request, Response } from "express";
import { z } from "zod";
import { ContactMessage } from "../models/ContactMessage.js";
import { VolunteerApplication } from "../models/VolunteerApplication.js";
import { NewsletterSubscriber } from "../models/NewsletterSubscriber.js";
import { asyncHandler, ApiError } from "../utils/asyncHandler.js";

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

const volunteerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().min(6).max(20),
  availability: z.string().max(40).optional(),
  skills: z.string().max(200).optional(),
  message: z.string().max(500).optional(),
});

export const submitVolunteerApplication = asyncHandler(async (req: Request, res: Response) => {
  const data = volunteerSchema.parse(req.body);
  const application = await VolunteerApplication.create(data);
  res.status(201).json({ message: "Application received", application });
});

export const listVolunteerApplications = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  const applications = await VolunteerApplication.find(filter).sort({ createdAt: -1 });
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
    { email: email.toLowerCase() },
    { upsert: true }
  );
  res.status(201).json({ message: "Subscribed" });
});

export const listNewsletterSubscribers = asyncHandler(async (_req: Request, res: Response) => {
  const subscribers = await NewsletterSubscriber.find().sort({ createdAt: -1 });
  res.json({ subscribers });
});
