import { Schema, model } from "mongoose";

const donationSchema = new Schema(
  {
    donorName: { type: String, required: true, trim: true },
    donorEmail: { type: String, required: true, trim: true, lowercase: true },
    donorPhone: { type: String, required: true, trim: true },
    panNumber: { type: String, required: true, trim: true },
    address: {
      line1: { type: String, required: true, trim: true },
      line2: { type: String, trim: true, default: "" },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      postalCode: { type: String, required: true, trim: true },
      country: { type: String, required: true, trim: true, default: "India" },
    },
    amount: { type: Number, required: true, min: 1 },
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    projectName: { type: String, required: true },
    isRecurring: { type: Boolean, default: false },
    paymentMethod: { type: String, enum: ["zoho"], default: "zoho" },
    message: { type: String, default: "" },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
    zohoPaymentSessionId: { type: String },
    zohoPaymentId: { type: String },
    // Set once a user is logged into the shop/main site and donates while signed in.
    user: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Donation = model("Donation", donationSchema);
