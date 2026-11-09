import type { ClientSession } from "mongoose";
import { z } from "zod";
import { VolunteerApplication } from "../models/VolunteerApplication.js";

const emailSchema = z.string().trim().email().max(254).transform((email) => email.toLowerCase());
const phoneSchema = z
  .string()
  .trim()
  .min(7)
  .max(20)
  .regex(/^[0-9+()\-\s]+$/)
  .refine((phone) => phone.replace(/\D/g, "").length >= 7, "Please provide a valid mobile number");

const volunteerFieldsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  phone: phoneSchema,
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((date) => {
      const parsed = new Date(`${date}T00:00:00.000Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date &&
        date <= new Date().toISOString().slice(0, 10);
    }, "Please provide a valid date of birth"),
  gender: z.string().max(40).optional().default(""),
  address: z.string().trim().min(2).max(300),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(80),
  country: z.string().trim().min(1).max(80),
  pinCode: z.string().trim().min(3).max(12),
  currentProfession: z.string().trim().min(1).max(120),
  organizationName: z.string().trim().min(1).max(150),
  educationalQualification: z.string().trim().min(1).max(120),
  occupation: z.enum([
    "Student",
    "Working Professional",
    "Self-employed",
    "Business Owner",
    "Homemaker",
    "Other",
  ]),
  whyVolunteer: z.string().trim().min(1).max(1000),
  areasOfInterest: z.array(z.string().trim().min(1).max(80)).min(1).max(10),
  preferredMode: z.enum(["On-site", "Remote", "Both"]),
  availability: z.enum(["Weekdays", "Weekends", "Flexible"]),
  hoursPerWeek: z.coerce.number().int().min(1).max(80),
  skills: z.string().trim().min(1).max(1000),
  additionalInformation: z.string().max(1000).optional().default(""),
});

export type VolunteerFields = z.infer<typeof volunteerFieldsSchema>;
export type VolunteerSource = "standalone" | "book_donation" | "book_purchase";

function getVolunteerField(
  input: Record<string, unknown>,
  canonical: string,
  aliases: string[] = [],
): unknown {
  for (const key of [canonical, ...aliases]) {
    if (input[key] !== undefined) return input[key];
  }
  return undefined;
}

export function parseVolunteerFields(raw: unknown): VolunteerFields {
  const input =
    raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawAreas = getVolunteerField(input, "areasOfInterest", ["areas"]);
  const areasOfInterest = Array.isArray(rawAreas)
    ? rawAreas
    : typeof rawAreas === "string"
      ? rawAreas.split(",").map((area) => area.trim()).filter(Boolean)
      : [];

  return volunteerFieldsSchema.parse({
    name: getVolunteerField(input, "name", ["fullName"]),
    email: getVolunteerField(input, "email"),
    phone: getVolunteerField(input, "phone", ["mobileNumber"]),
    dateOfBirth: getVolunteerField(input, "dateOfBirth"),
    gender: getVolunteerField(input, "gender"),
    address: getVolunteerField(input, "address"),
    city: getVolunteerField(input, "city"),
    state: getVolunteerField(input, "state"),
    country: getVolunteerField(input, "country"),
    pinCode: getVolunteerField(input, "pinCode"),
    currentProfession: getVolunteerField(input, "currentProfession"),
    organizationName: getVolunteerField(input, "organizationName"),
    educationalQualification: getVolunteerField(input, "educationalQualification"),
    occupation: getVolunteerField(input, "occupation"),
    whyVolunteer: getVolunteerField(input, "whyVolunteer", ["reason", "message"]),
    areasOfInterest,
    preferredMode: getVolunteerField(input, "preferredMode", ["preferredVolunteeringMode"]),
    availability: getVolunteerField(input, "availability"),
    hoursPerWeek: getVolunteerField(input, "hoursPerWeek"),
    skills: getVolunteerField(input, "skills"),
    additionalInformation: getVolunteerField(input, "additionalInformation"),
  });
}

export async function saveVolunteerApplication(
  fields: VolunteerFields,
  registrationSource: VolunteerSource,
  relations: { bookDonation?: string; order?: string } = {},
  session?: ClientSession,
) {
  const setFields = {
    name: fields.name,
    email: fields.email,
    phone: fields.phone,
    dateOfBirth: fields.dateOfBirth,
    gender: fields.gender,
    address: fields.address,
    city: fields.city,
    state: fields.state,
    country: fields.country,
    pinCode: fields.pinCode,
    currentProfession: fields.currentProfession,
    organizationName: fields.organizationName,
    educationalQualification: fields.educationalQualification,
    occupation: fields.occupation,
    whyVolunteer: fields.whyVolunteer,
    areasOfInterest: fields.areasOfInterest,
    preferredMode: fields.preferredMode,
    availability: fields.availability,
    hoursPerWeek: fields.hoursPerWeek,
    skills: fields.skills,
    message: fields.whyVolunteer,
    additionalInformation: fields.additionalInformation,
  };
  const setOnInsert: Record<string, unknown> = {
    email: fields.email,
    registrationSource,
    status: "new",
  };
  const update: Record<string, unknown> = {
    $set: setFields,
    $setOnInsert: setOnInsert,
  };
  if (relations.bookDonation) {
    update.$set = { ...setFields, bookDonation: relations.bookDonation };
  }
  if (relations.order) {
    update.$set = { ...(update.$set as object), order: relations.order };
  }

  const options = {
    upsert: true,
    new: true,
    runValidators: true,
    setDefaultsOnInsert: true,
    ...(session ? { session } : {}),
  };
  try {
    return await VolunteerApplication.findOneAndUpdate({ email: fields.email }, update, options);
  } catch (error) {
    if (!session && (error as { code?: number }).code === 11000) {
      return VolunteerApplication.findOneAndUpdate(
        { email: fields.email },
        { $set: setFields },
        { ...options, upsert: false },
      );
    }
    throw error;
  }
}
