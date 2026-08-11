import { Schema, model } from "mongoose";

const newsletterSubscriberSchema = new Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  },
  { timestamps: true }
);

export const NewsletterSubscriber = model("NewsletterSubscriber", newsletterSubscriberSchema);
