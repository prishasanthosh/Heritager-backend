import type { Request, Response } from "express";
import { z } from "zod";
import { Donation } from "../models/Donation.js";
import { Project } from "../models/Project.js";
import { asyncHandler, ApiError } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";
import { createPaymentSession, getPaymentStatus, isZohoConfigured } from "../services/zohoPayments.js";

const addressSchema = z.object({
  line1: z.string().min(2).max(200),
  line2: z.string().max(200).optional().default(""),
  city: z.string().min(1).max(80),
  state: z.string().min(1).max(80),
  postalCode: z.string().min(3).max(12),
  country: z.string().min(1).max(80).default("India"),
});

const donateSchema = z.object({
  donorName: z.string().min(2).max(100),
  donorEmail: z.string().email(),
  donorPhone: z.string().min(6).max(20),
  dateOfBirth: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional(),
  customPurpose: z.string().max(200).optional(),
  communicationConsent: z.boolean().optional().default(false),
  panNumber: z.string().min(4).max(20),
  address: addressSchema,
  amount: z.coerce.number().min(1).max(1_000_000),
  projectId: z.string(),
  isRecurring: z.boolean().optional().default(false),
  message: z.string().min(1).max(500),
});

export const createDonation = asyncHandler(async (req: Request, res: Response) => {
  const data = donateSchema.parse(req.body);
  if (!isZohoConfigured) {
    throw new ApiError(503, "Online donations are temporarily unavailable. Please try again later.");
  }

  const project = await Project.findById(data.projectId);
  if (!project || !project.isActive) {
    throw new ApiError(400, "Please choose a valid donation purpose");
  }
  if (project.slug === "general-donation-for-organization" && !data.customPurpose?.trim()) {
    throw new ApiError(400, "Please tell us what your donation purpose is");
  }

  const donation = await Donation.create({
    donorName: data.donorName,
    donorEmail: data.donorEmail,
    donorPhone: data.donorPhone,
    dateOfBirth: data.dateOfBirth ?? "",
    customPurpose: data.customPurpose?.trim() ?? "",
    communicationConsent: data.communicationConsent,
    panNumber: data.panNumber,
    address: data.address,
    amount: data.amount,
    project: project._id,
    projectName: data.customPurpose?.trim() || project.name,
    isRecurring: data.isRecurring,
    message: data.message,
    user: req.user?.sub,
  });

  const successUrl = new URL(env.zoho.donationReturnUrl);
  successUrl.searchParams.set("paymentResult", "success");
  successUrl.searchParams.set("donationId", donation.id);
  const failureUrl = new URL(successUrl);
  failureUrl.searchParams.set("paymentResult", "failure");

  const session = await createPaymentSession({
    amountInRupees: data.amount,
    description: `Donation — ${project.name}`,
    orderId: donation.id,
    customerEmail: data.donorEmail,
    customerPhone: data.donorPhone,
    successUrl: successUrl.toString(),
    failureUrl: failureUrl.toString(),
  });

  donation.zohoPaymentSessionId = session.payments_session_id;
  await donation.save();

  const checkoutUrl = new URL(
    `/hostedcheckout/${encodeURIComponent(session.access_key)}`,
    env.zoho.apiDomain
  );
  res.status(201).json({
    donation,
    zohoPaymentSessionId: session.payments_session_id,
    zohoCheckoutUrl: checkoutUrl.toString(),
  });
});

export const confirmDonationPayment = asyncHandler(async (req: Request, res: Response) => {
  const { paymentId, paymentsSessionId } = z
    .object({ paymentId: z.string().min(1), paymentsSessionId: z.string().min(1) })
    .parse(req.body);
  const donation = await Donation.findById(req.params.id);
  if (!donation) throw new ApiError(404, "Donation not found");
  if (!donation.zohoPaymentSessionId || donation.zohoPaymentSessionId !== paymentsSessionId) {
    throw new ApiError(400, "Payment session does not match this donation");
  }

  const { payment } = await getPaymentStatus(paymentId);
  if (
    payment.payment_id !== paymentId ||
    payment.payments_session_id !== donation.zohoPaymentSessionId ||
    payment.currency !== "INR" ||
    Math.round(Number(payment.amount) * 100) !== Math.round(donation.amount * 100)
  ) {
    throw new ApiError(400, "Zoho payment details do not match this donation");
  }

  donation.zohoPaymentId = payment.payment_id;
  donation.paymentStatus =
    payment.status === "succeeded"
      ? "paid"
      : payment.status === "failed" || payment.status === "cancelled"
        ? "failed"
        : "pending";
  await donation.save();

  res.json({ donation });
});

export const getDonation = asyncHandler(async (req: Request, res: Response) => {
  const donation = await Donation.findById(req.params.id);
  if (!donation) throw new ApiError(404, "Donation not found");
  res.json({ donation });
});

// --- Admin ---

export const listDonations = asyncHandler(async (req: Request, res: Response) => {
  const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (status) filter.paymentStatus = status;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

  const [donations, total, totalRaisedAgg] = await Promise.all([
    Donation.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    Donation.countDocuments(filter),
    Donation.aggregate([{ $match: { paymentStatus: "paid" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
  ]);

  res.json({
    donations,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    totalRaised: totalRaisedAgg[0]?.total ?? 0,
  });
});

// Manual confirmation for donations collected outside Zoho (bank transfer, cash, etc.)
const markPaidSchema = z.object({ note: z.string().max(300).optional() });

export const markDonationPaid = asyncHandler(async (req: Request, res: Response) => {
  markPaidSchema.parse(req.body ?? {});
  const donation = await Donation.findByIdAndUpdate(req.params.id, { paymentStatus: "paid" }, { new: true });
  if (!donation) throw new ApiError(404, "Donation not found");
  res.json({ donation });
});
