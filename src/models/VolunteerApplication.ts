import { Schema, model } from "mongoose";

const volunteerApplicationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    dateOfBirth: { type: String, default: "" },
    gender: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "" },
    pinCode: { type: String, default: "" },
    currentProfession: { type: String, default: "" },
    organizationName: { type: String, default: "" },
    educationalQualification: { type: String, default: "" },
    occupation: { type: String, default: "" },
    whyVolunteer: { type: String, default: "" },
    areasOfInterest: { type: [String], default: [] },
    preferredMode: { type: String, default: "" },
    availability: { type: String, default: "Flexible" },
    hoursPerWeek: { type: Number, min: 1, max: 80 },
    skills: { type: String, default: "" },
    message: { type: String, default: "" },
    additionalInformation: { type: String, default: "" },
    registrationSource: {
      type: String,
      enum: ["standalone", "book_donation", "book_purchase"],
      default: "standalone",
    },
    bookDonation: { type: Schema.Types.ObjectId, ref: "BookDonation" },
    order: { type: Schema.Types.ObjectId, ref: "Order" },
    status: { type: String, enum: ["new", "contacted", "onboarded", "declined"], default: "new" },
  },
  { timestamps: true }
);

volunteerApplicationSchema.index({ email: 1 }, { unique: true, name: "volunteer_email_unique" });
volunteerApplicationSchema.index({ registrationSource: 1, createdAt: -1 });
volunteerApplicationSchema.index({ bookDonation: 1 });
volunteerApplicationSchema.index({ order: 1 });

export const VolunteerApplication = model("VolunteerApplication", volunteerApplicationSchema);
