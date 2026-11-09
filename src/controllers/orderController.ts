import type { Request, Response } from "express";
import { z } from "zod";
import { Cart } from "../models/Cart.js";
import { Order, ORDER_STATUSES } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { User } from "../models/User.js";
import { env, isZohoPaymentsEnabled } from "../config/env.js";
import { asyncHandler, ApiError } from "../utils/asyncHandler.js";
import { createPaymentSession, getPaymentStatus } from "../services/zohoPayments.js";
import { parseVolunteerFields, saveVolunteerApplication } from "../utils/volunteer.js";

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
  volunteerRegistration: z.unknown().optional(),
});

const SHIPPING_FEE = 49;
const FREE_SHIPPING_THRESHOLD = 999;

async function restoreOrderStock(order: InstanceType<typeof Order>) {
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
  }
}

function orderCallbackUrl(orderId: string): string {
  return new URL(`/api/orders/${encodeURIComponent(orderId)}/zoho-callback`, env.publicApiUrl).toString();
}

async function processVerifiedZohoPayment(
  order: InstanceType<typeof Order>,
  paymentId: string,
) {
  if (order.paymentMethod !== "zoho") {
    throw new ApiError(400, "This order does not use Zoho Payments");
  }

  const { payment } = await getPaymentStatus(paymentId);
  if (
    payment.payment_id !== paymentId ||
    !order.zohoPaymentSessionId ||
    payment.payments_session_id !== order.zohoPaymentSessionId ||
    payment.currency !== "INR" ||
    !Number.isFinite(Number(payment.amount)) ||
    Math.abs(Number(payment.amount) - order.total) > 0.01
  ) {
    throw new ApiError(400, "The payment does not match this order");
  }

  order.zohoPaymentId = payment.payment_id;
  if (payment.status === "succeeded") {
    if (order.paymentStatus === "pending" && order.status === "pending") {
      const transitioned = await Order.findOneAndUpdate(
        { _id: order._id, paymentStatus: "pending", status: "pending" },
        {
          $set: {
            paymentStatus: "paid",
            status: "processing",
            zohoPaymentId: payment.payment_id,
          },
          $push: {
            statusHistory: { status: "processing", note: "Payment verified with Zoho" },
          },
        },
        { new: true },
      );
      if (transitioned) order = transitioned;
      else order = (await Order.findById(order._id))!;
    } else if (order.paymentStatus !== "paid") {
      await order.save();
      return { paymentStatus: "review_required" as const, order };
    } else {
      await order.save();
    }

    if (order.volunteerRegistration && !order.volunteerApplication) {
      const application = await saveVolunteerApplication(
        parseVolunteerFields(order.volunteerRegistration),
        "book_purchase",
        { order: String(order._id) },
      );
      if (!application) throw new ApiError(500, "Could not save volunteer registration");
      order.volunteerApplication = application._id;
      await order.save();
    }
    return { paymentStatus: "paid" as const, order };
  }

  if (payment.status === "failed" || payment.status === "cancelled") {
    if (order.paymentStatus === "pending" && order.status === "pending") {
      const transitioned = await Order.findOneAndUpdate(
        { _id: order._id, paymentStatus: "pending", status: "pending" },
        {
          $set: {
            paymentStatus: "failed",
            status: "cancelled",
            zohoPaymentId: payment.payment_id,
          },
          $push: {
            statusHistory: { status: "cancelled", note: "Zoho payment failed or was cancelled" },
          },
        },
        { new: true },
      );
      if (transitioned) {
        order = transitioned;
        await restoreOrderStock(order);
      } else {
        order = (await Order.findById(order._id))!;
      }
    } else {
      await order.save();
    }
    return { paymentStatus: "failed" as const, order };
  }

  await order.save();
  return { paymentStatus: "pending" as const, order };
}

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  const { shippingAddress, paymentMethod, volunteerRegistration: rawVolunteerRegistration } =
    checkoutSchema.parse(req.body);
  if (paymentMethod === "zoho" && !isZohoPaymentsEnabled) {
    throw new ApiError(503, "Online payments are temporarily unavailable. Please choose another payment method.");
  }
  const volunteerFields = rawVolunteerRegistration
    ? parseVolunteerFields(rawVolunteerRegistration)
    : undefined;

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
    ...(volunteerFields
      ? {
          volunteerRegistration: {
            ...volunteerFields,
            additionalInformation: volunteerFields.additionalInformation,
          },
        }
      : {}),
    statusHistory: [{ status: "pending", note: "Order placed" }],
  });

  const reservedItems: typeof orderItems = [];
  try {
    for (const item of orderItems) {
      const reserved = await Product.findOneAndUpdate(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true },
      );
      if (!reserved) throw new ApiError(409, `Stock changed for "${item.name}". Please review your cart.`);
      reservedItems.push(item);
    }
  } catch (error) {
    for (const item of reservedItems) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
    }
    order.status = "cancelled";
    order.paymentStatus = "failed";
    order.statusHistory.push({ status: "cancelled", note: "Stock could not be reserved" } as never);
    await order.save();
    throw error;
  }

  if (paymentMethod === "cod") {
    if (volunteerFields) {
      const application = await saveVolunteerApplication(volunteerFields, "book_purchase", {
        order: String(order._id),
      });
      if (!application) throw new ApiError(500, "Could not save volunteer registration");
      order.volunteerApplication = application._id;
      await order.save();
    }
    cart.items.splice(0, cart.items.length);
    await cart.save();
    res.status(201).json({ order });
    return;
  }

  try {
    const user = await User.findById(req.user!.sub);
    const callbackUrl = orderCallbackUrl(String(order._id));
    const session = await createPaymentSession({
      amountInRupees: total,
      description: `Order ${order.id}`,
      orderId: order.id,
      customerEmail: user?.email ?? "",
      customerPhone: shippingAddress.phone,
      successUrl: callbackUrl,
      failureUrl: callbackUrl,
    });

    order.zohoPaymentSessionId = session.payments_session_id;
    await order.save();
    cart.items.splice(0, cart.items.length);
    await cart.save();

    res.status(201).json({
      order,
      zohoPaymentSessionId: session.payments_session_id,
      checkoutUrl: session.checkout_url,
    });
  } catch (error) {
    await restoreOrderStock(order);
    order.status = "cancelled";
    order.paymentStatus = "failed";
    order.statusHistory.push({ status: "cancelled", note: "Zoho checkout could not be started" } as never);
    await order.save();
    throw error;
  }
});

export const confirmZohoPayment = asyncHandler(async (req: Request, res: Response) => {
  const { paymentId } = z.object({ paymentId: z.string() }).parse(req.body);
  const order = await Order.findOne({ _id: req.params.orderId, user: req.user!.sub });
  if (!order) throw new ApiError(404, "Order not found");
  const result = await processVerifiedZohoPayment(order, paymentId);
  res.json({ order: result.order, paymentStatus: result.paymentStatus });
});

export const zohoPaymentReturn = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) throw new ApiError(404, "Order not found");
  const paymentId = z.string().min(1).optional().parse(
    req.query.payment_id ?? req.query.paymentId,
  );
  let result: "success" | "failure" | "pending" | "review" = "pending";
  if (paymentId) {
    const verified = await processVerifiedZohoPayment(order, paymentId);
    result =
      verified.paymentStatus === "paid"
        ? "success"
        : verified.paymentStatus === "failed"
          ? "failure"
          : verified.paymentStatus === "review_required"
            ? "review"
            : "pending";
  }
  const redirectUrl = new URL(`/orders/${encodeURIComponent(String(order._id))}`, env.shopUrl);
  redirectUrl.searchParams.set("paymentResult", result);
  res.redirect(303, redirectUrl.toString());
});

export const zohoPaymentWebhook = asyncHandler(async (req: Request, res: Response) => {
  const body = z
    .object({
      payment_id: z.string().min(1).optional(),
      payment: z.object({ payment_id: z.string().min(1).optional() }).optional(),
      data: z.object({ payment_id: z.string().min(1).optional() }).optional(),
    })
    .passthrough()
    .parse(req.body);
  const paymentId = body.payment_id ?? body.payment?.payment_id ?? body.data?.payment_id;
  if (!paymentId) throw new ApiError(400, "Zoho webhook did not include a payment ID");

  const { payment } = await getPaymentStatus(paymentId);
  const order = await Order.findOne({ zohoPaymentSessionId: payment.payments_session_id });
  if (!order) throw new ApiError(404, "No order matches this Zoho payment session");
  await processVerifiedZohoPayment(order, paymentId);
  res.status(200).json({ received: true });
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
