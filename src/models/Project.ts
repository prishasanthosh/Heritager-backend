import { Schema, model } from "mongoose";

/**
 * Drives the "Donation purpose" dropdown on the public /give page. Seeded
 * with the foundation's current initiatives; admins can add more later and
 * they'll appear automatically without a code change.
 */
const projectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Project = model("Project", projectSchema);
