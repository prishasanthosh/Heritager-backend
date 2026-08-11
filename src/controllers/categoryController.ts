import type { Request, Response } from "express";
import { z } from "zod";
import { Category } from "../models/Category.js";
import { asyncHandler, ApiError } from "../utils/asyncHandler.js";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const categorySchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(500).optional().default(""),
  image: z.string().url().optional().or(z.literal("")),
});

export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await Category.find().sort({ name: 1 });
  res.json({ categories });
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const data = categorySchema.parse(req.body);
  const category = await Category.create({ ...data, slug: slugify(data.name) });
  res.status(201).json({ category });
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const data = categorySchema.partial().parse(req.body);
  const update: Record<string, unknown> = { ...data };
  if (data.name) update.slug = slugify(data.name);

  const category = await Category.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!category) throw new ApiError(404, "Category not found");
  res.json({ category });
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new ApiError(404, "Category not found");
  res.json({ message: "Category deleted" });
});
