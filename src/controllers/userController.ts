import type { Request, Response } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { asyncHandler, ApiError } from "../utils/asyncHandler.js";

const addressSchema = z.object({
  label: z.string().optional().default("Home"),
  line1: z.string().min(2),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(3),
  country: z.string().optional().default("India"),
  phone: z.string().min(6),
  isDefault: z.boolean().optional().default(false),
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const { name, phone } = z.object({ name: z.string().min(2).optional(), phone: z.string().optional() }).parse(req.body);
  const user = await User.findByIdAndUpdate(req.user!.sub, { ...(name && { name }), ...(phone && { phone }) }, { new: true });
  if (!user) throw new ApiError(404, "User not found");
  res.json({ user });
});

export const addAddress = asyncHandler(async (req: Request, res: Response) => {
  const data = addressSchema.parse(req.body);
  const user = await User.findById(req.user!.sub);
  if (!user) throw new ApiError(404, "User not found");

  if (data.isDefault) {
    user.addresses.forEach((a) => (a.isDefault = false));
  }
  user.addresses.push(data as never);
  await user.save();
  res.status(201).json({ user });
});

export const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.sub);
  if (!user) throw new ApiError(404, "User not found");
  user.addresses = user.addresses.filter((a) => a.id !== req.params.addressId) as typeof user.addresses;
  await user.save();
  res.json({ user });
});

// --- Admin ---

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { q, page = "1", limit = "20" } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (q) filter.$or = [{ name: new RegExp(q, "i") }, { email: new RegExp(q, "i") }];

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    User.countDocuments(filter),
  ]);

  res.json({ users, total, page: pageNum, pages: Math.ceil(total / limitNum) });
});

export const setUserRole = asyncHandler(async (req: Request, res: Response) => {
  const { role } = z.object({ role: z.enum(["customer", "admin"]) }).parse(req.body);
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  if (!user) throw new ApiError(404, "User not found");
  res.json({ user });
});
