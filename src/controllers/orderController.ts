import type { Request, Response } from "express";
import { z } from "zod";
import { Cart } from "../models/Cart.js";
import { Order, ORDER_STATUSES } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { User } from "../models/User.js";
import { asyncHandler, ApiError } from "../utils/asyncHandler.js";
import { createPaymentSession, getPaymentStatus } from "../services/zohoPayments.js";

const addressSchema = z.object({
  fullName: z.string().min(2),
  line1: z.string().min(2),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(3),
  country: z.string().optional().default("India"),
  phone: z.string().min(6),
});

const checkoutSchema = z.object({
  shippingAddress: addressSchema,
  paymentMethod: z.enum(["cod", "zoho"]),
});

const SHIPPING_FEE = 49;
const FREE_SHIPPING_THRESHOLD = 999;

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  const { shippingAddress, paymentMethod } = checkoutSchema.parse(req.body);

  const cart = await Cart.findOne({ user: req.user!.sub }).populate("items.product");
  if (!cart || cart.items.length === 0) {
    throw new ApiError(400, "Your cart is empty");
  }

  const orderItems = [];
  let itemsTotal = 0;

  for (const item of cart.items) {
    const product = item.product as unknown as InstanceType<typeof Product>;
    if (!product || !product.isActive) {
      throw new ApiError(400, `"${product?.name ?? "A product"}" is no longer available`);
    }
    if (product.stock < item.quantity) {
      throw new ApiError(400, `Only ${product.stock} left in stock for "${product.name}"`);
    }
    orderItems.push({
      product: product._id,
      name: product.name,
      image: product.images[0]?.url ?? "",
      price: product.price,
      quantity: item.quantity,
    });
    itemsTotal += product.price * item.quantity;
  }

  const shippingFee = itemsTotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = itemsTotal + shippingFee;

  const order = await Order.create({
    user: req.user!.sub,
    items: orderItems,
    shippingAddress,
    itemsTotal,
    shippingFee,
    total,
    paymentMethod,
    paymentStatus: "pending",
    status: "pending",
    statusHistory: [{ status: "pending", note: "Order placed" }],
  });

  // Reserve stock immediately to avoid overselling.
  for (const item of orderItems) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
  }

  cart.items.splice(0, cart.items.length);
  await cart.save();

  if (paymentMethod === "cod") {
    res.status(201).json({ order });
    return;
  }

  const user = await User.findById(req.user!.sub);
  const session = await createPaymentSession({
    amountInRupees: total,
    description: `Order ${order.id}`,
    orderId: order.id,
    customerEmail: user?.email ?? "",
    customerPhone: shippingAddress.phone,
  });

  order.zohoPaymentSessionId = session.payments_session_id;
  await order.save();

  res.status(201).json({ order, zohoPaymentSessionId: session.payments_session_id });
});

export const confirmZohoPayment = asyncHandler(async (req: Request, res: Response) => {
  const { paymentId } = z.object({ paymentId: z.string() }).parse(req.body);
  const order = await Order.findOne({ _id: req.params.orderId, user: req.user!.sub });
  if (!order) throw new ApiError(404, "Order not found");

  const { payment } = await getPaymentStatus(paymentId);
  order.zohoPaymentId = payment.payment_id;

  if (payment.status === "succeeded") {
    order.paymentStatus = "paid";
    order.status = "processing";
    order.statusHistory.push({ status: "processing", note: "Payment confirmed via Zoho" } as never);
  } else if (payment.status === "failed" || payment.status === "cancelled") {
    order.paymentStatus = "failed";
  }
  await order.save();
  res.json({ order });
});

export const myOrders = asyncHandler(async (req: Request, res: Response) => {
  const orders = await Order.find({ user: req.user!.sub }).sort({ createdAt: -1 });
  res.json({ orders });
});

export const myOrderById = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user!.sub });
  if (!order) throw new ApiError(404, "Order not found");
  res.json({ order });
});

// --- Admin ---

export const listAllOrders = asyncHandler(async (req: Request, res: Response) => {
  const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Order.countDocuments(filter),
  ]);

  res.json({ orders, total, page: pageNum, pages: Math.ceil(total / limitNum) });
});

const statusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().max(300).optional(),
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status, note } = statusUpdateSchema.parse(req.body);
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

  if (status === "cancelled" && order.status !== "cancelled") {
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
    }
  }

  order.status = status;
  order.statusHistory.push({ status, note } as never);
  await order.save();
  res.json({ order });
});
