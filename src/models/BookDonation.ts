import { Schema, model } from "mongoose";

export const BOOK_CONDITIONS = ["New", "Like New", "Good", "Acceptable"] as const;
export const BOOK_DONATION_STATUSES = ["pending_review", "approved", "rejected"] as const;
export const BOOK_DELIVERY_METHODS = ["drop_off", "courier", "not_specified"] as const;

const photoSchema = new Schema(
  { url: { type: String, required: true }, publicId: { type: String, default: "" } },
  { _id: false }
);

const bookDonationSchema = new Schema(
  {
    donor: {
      fullName: { type: String, required: true, trim: true },
      dateOfBirth: { type: String, trim: true, default: "" },
      phone: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      address: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pinCode: { type: String, required: true, trim: true },
    },
    book: {
      title: { type: String, required: true, trim: true },
      author: { type: String, required: true, trim: true },
      publisher: { type: String, trim: true, default: "" },
      edition: { type: String, trim: true, default: "" },
      isbn: { type: String, trim: true, default: "" },
      subject: { type: String, trim: true, default: "" },
      category: { type: String, trim: true, default: "" },
      academicLevel: { type: String, trim: true, default: "" },
      condition: { type: String, enum: BOOK_CONDITIONS, required: true },
      quantity: { type: Number, required: true, min: 1, default: 1 },
      language: { type: String, trim: true, default: "" },
    },
    photos: { type: [photoSchema], default: [] },
    additionalNotes: { type: String, default: "" },
    consent: { type: Boolean, required: true },
    deliveryMethod: { type: String, enum: BOOK_DELIVERY_METHODS, default: "not_specified" },
    volunteerApplication: { type: Schema.Types.ObjectId, ref: "VolunteerApplication" },
    idempotencyKey: { type: String, trim: true },
    confirmationEmail: {
      status: {
        type: String,
        enum: ["pending", "sent", "failed", "not_configured", "disabled"],
        default: "pending",
      },
      messageId: { type: String, default: "" },
      error: { type: String, default: "" },
      sentAt: { type: Date },
    },
    status: { type: String, enum: BOOK_DONATION_STATUSES, default: "pending_review" },
    adminNote: { type: String, default: "" },
    product: { type: Schema.Types.ObjectId, ref: "Product" },
  },
  { timestamps: true }
);

bookDonationSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export const BookDonation = model("BookDonation", bookDonationSchema);
