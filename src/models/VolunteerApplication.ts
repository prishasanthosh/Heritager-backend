import { Schema, model } from "mongoose";

const volunteerApplicationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    availability: { type: String, default: "Flexible" },
    skills: { type: String, default: "" },
    message: { type: String, default: "" },
    status: { type: String, enum: ["new", "contacted", "onboarded", "declined"], default: "new" },
  },
  { timestamps: true }
);

export const VolunteerApplication = model("VolunteerApplication", volunteerApplicationSchema);
