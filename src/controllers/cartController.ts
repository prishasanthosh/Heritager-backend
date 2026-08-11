import type { Request, Response } from "express";
import { z } from "zod";
import { Cart } from "../models/Cart.js";
import { Product } from "../models/Product.js";
import { asyncHandler, ApiError } from "../utils/asyncHandler.js";

async function getOrCreateCart(userId: string) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
}

export const getCart = asyncHandler(async (req: Request, res: Response) => {
  const cart = await getOrCreateCart(req.user!.sub);
  await cart.populate("items.product");
  res.json({ cart });
});

const addItemSchema = z.object({
  productId: z.string(),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
});

export const addItem = asyncHandler(async (req: Request, res: Response) => {
  const { productId, quantity } = addItemSchema.parse(req.body);

  const product = await Product.findById(productId);
  if (!product || !product.isActive) throw new ApiError(404, "Product not found");

  const cart = await getOrCreateCart(req.user!.sub);
  const existing = cart.items.find((i) => i.product.toString() === productId);
  if (existing) {
    existing.quantity = Math.min(50, existing.quantity + quantity);
  } else {
    cart.items.push({ product: product._id, quantity });
  }
  await cart.save();
  await cart.populate("items.product");
  res.json({ cart });
});

const updateItemSchema = z.object({ quantity: z.coerce.number().int().min(1).max(50) });

export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const { quantity } = updateItemSchema.parse(req.body);
  const cart = await getOrCreateCart(req.user!.sub);
  const item = cart.items.find((i) => i.product.toString() === req.params.productId);
  if (!item) throw new ApiError(404, "Item not in cart");
  item.quantity = quantity;
  await cart.save();
  await cart.populate("items.product");
  res.json({ cart });
});

export const removeItem = asyncHandler(async (req: Request, res: Response) => {
  const cart = await getOrCreateCart(req.user!.sub);
  cart.items.pull({ product: req.params.productId });
  await cart.save();
  await cart.populate("items.product");
  res.json({ cart });
});

export const clearCart = asyncHandler(async (req: Request, res: Response) => {
  const cart = await getOrCreateCart(req.user!.sub);
  cart.items.splice(0, cart.items.length);
  await cart.save();
  res.json({ cart });
});
