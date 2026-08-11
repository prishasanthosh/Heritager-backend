import type { Request, Response } from "express";
import { z } from "zod";
import { Product } from "../models/Product.js";
import { asyncHandler, ApiError } from "../utils/asyncHandler.js";
import { cloudinary } from "../config/cloudinary.js";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 7);

const imageSchema = z.object({ url: z.string().url(), publicId: z.string().optional().default("") });

const productSchema = z.object({
  name: z.string().min(2).max(140),
  description: z.string().max(5000).optional().default(""),
  price: z.coerce.number().min(0),
  compareAtPrice: z.coerce.number().min(0).optional(),
  category: z.string().optional(),
  images: z.array(imageSchema).optional().default([]),
  stock: z.coerce.number().min(0).optional().default(0),
  sku: z.string().optional(),
  isFeatured: z.coerce.boolean().optional().default(false),
  isActive: z.coerce.boolean().optional().default(true),
  tags: z.array(z.string()).optional().default([]),
});

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const { q, category, featured, page = "1", limit = "12", includeInactive } = req.query as Record<string, string>;

  const filter: Record<string, unknown> = {};
  if (!includeInactive) filter.isActive = true;
  if (category) filter.category = category;
  if (featured === "true") filter.isFeatured = true;
  if (q) filter.$text = { $search: q };

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(60, Math.max(1, Number(limit) || 12));

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Product.countDocuments(filter),
  ]);

  res.json({ products, total, page: pageNum, pages: Math.ceil(total / limitNum) });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const { idOrSlug } = req.params;
  const query = idOrSlug.match(/^[0-9a-fA-F]{24}$/) ? { _id: idOrSlug } : { slug: idOrSlug };
  const product = await Product.findOne(query).populate("category", "name slug");
  if (!product) throw new ApiError(404, "Product not found");
  res.json({ product });
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const data = productSchema.parse(req.body);
  const product = await Product.create({ ...data, slug: slugify(data.name) });
  res.status(201).json({ product });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const data = productSchema.partial().parse(req.body);
  const product = await Product.findByIdAndUpdate(req.params.id, data, { new: true });
  if (!product) throw new ApiError(404, "Product not found");
  res.json({ product });
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new ApiError(404, "Product not found");

  await Promise.all(
    product.images.filter((img) => img.publicId).map((img) => cloudinary.uploader.destroy(img.publicId))
  );

  res.json({ message: "Product deleted" });
});
