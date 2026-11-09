import { env } from "../config/env.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";

export async function expireUnpaidZohoOrders(): Promise<number> {
  const expiryMinutes = Number.isFinite(env.unpaidOrderExpiryMinutes)
    ? Math.max(15, env.unpaidOrderExpiryMinutes)
    : 60;
  const cutoff = new Date(Date.now() - expiryMinutes * 60 * 1000);
  const candidates = await Order.find({
    paymentMethod: "zoho",
    paymentStatus: "pending",
    status: "pending",
    createdAt: { $lt: cutoff },
  })
    .select("_id items")
    .limit(100)
    .lean();

  let expiredCount = 0;
  for (const candidate of candidates) {
    const expired = await Order.findOneAndUpdate(
      {
        _id: candidate._id,
        paymentMethod: "zoho",
        paymentStatus: "pending",
        status: "pending",
        createdAt: { $lt: cutoff },
      },
      {
        $set: { paymentStatus: "failed", status: "cancelled" },
        $push: {
          statusHistory: {
            status: "cancelled",
            note: "Zoho checkout expired without verified payment",
          },
        },
      },
      { new: true },
    );
    if (!expired) continue;

    for (const item of expired.items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
    }
    expiredCount += 1;
  }
  return expiredCount;
}
