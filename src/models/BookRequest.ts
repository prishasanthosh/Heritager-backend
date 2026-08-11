import { Schema, model } from "mongoose";

export const BOOK_REQUEST_STATUSES = ["pending", "approved", "fulfilled", "rejected"] as const;

const documentSchema = new Schema(
  { url: { type: String, required: true }, publicId: { type: String, default: "" } },
  { _id: false }
);

const bookRequestSchema = new Schema(
  {
    student: {
      fullName: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
      institutionName: { type: String, required: true, trim: true },
      courseClass: { type: String, required: true, trim: true },
      yearSemester: { type: String, required: true, trim: true },
    },
    book: {
      name: { type: String, required: true, trim: true },
      author: { type: String, trim: true, default: "" },
      subject: { type: String, required: true, trim: true },
      edition: { type: String, trim: true, default: "" },
      quantityRequired: { type: Number, required: true, min: 1 },
    },
    reason: { type: String, required: true, trim: true },
    studentIdDocument: { type: documentSchema, required: true },
    supportingDocument: { type: documentSchema },
    status: { type: String, enum: BOOK_REQUEST_STATUSES, default: "pending" },
    adminNote: { type: String, default: "" },
  },
  { timestamps: true }
);

export const BookRequest = model("BookRequest", bookRequestSchema);
