import { Schema, model } from "mongoose";

const orderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    image: { type: String, default: "" },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const shippingAddressSchema = new Schema(
  {
    fullName: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, default: "India" },
    phone: { type: String, required: true },
  },
  { _id: false }
);

export const ORDER_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;

const orderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [orderItemSchema], required: true },
    shippingAddress: { type: shippingAddressSchema, required: true },
    itemsTotal: { type: Number, required: true },
    shippingFee: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: "pending" },
    paymentMethod: { type: String, enum: ["cod", "zoho"], required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "pending" },
    zohoPaymentSessionId: { type: String },
    zohoPaymentId: { type: String },
    volunteerRegistration: {
      type: new Schema(
        {
          name: { type: String, required: true, trim: true },
          email: { type: String, required: true, trim: true, lowercase: true },
          phone: { type: String, required: true, trim: true },
          dateOfBirth: { type: String, required: true },
          gender: { type: String, default: "" },
          address: { type: String, required: true },
          city: { type: String, required: true },
          state: { type: String, required: true },
          country: { type: String, required: true },
          pinCode: { type: String, required: true },
          currentProfession: { type: String, required: true },
          organizationName: { type: String, required: true },
          educationalQualification: { type: String, required: true },
          occupation: { type: String, required: true },
          whyVolunteer: { type: String, required: true },
          areasOfInterest: { type: [String], default: [] },
          preferredMode: { type: String, required: true },
          availability: { type: String, required: true },
          hoursPerWeek: { type: Number, required: true },
          skills: { type: String, required: true },
          additionalInformation: { type: String, default: "" },
        },
        { _id: false }
      ),
    },
    volunteerApplication: { type: Schema.Types.ObjectId, ref: "VolunteerApplication" },
    statusHistory: {
      type: [
        new Schema(
          { status: String, at: { type: Date, default: Date.now }, note: String },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const Order = model("Order", orderSchema);
