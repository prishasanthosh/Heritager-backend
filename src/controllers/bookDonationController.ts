import type { Request, Response } from "express";
import { z } from "zod";
import { BookDonation, BOOK_CONDITIONS, BOOK_DELIVERY_METHODS } from "../models/BookDonation.js";
import { Category } from "../models/Category.js";
import { Product } from "../models/Product.js";
import { isCloudinaryConfigured } from "../config/env.js";
import { toPublicFile } from "../config/localUpload.js";
import { asyncHandler, ApiError } from "../utils/asyncHandler.js";

const PROJECT_CATEGORY_NAME = "Project Vidhyadhanam";
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const submitSchema = z.object({
  donorFullName: z.string().min(2).max(100),
  donorDateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  donorPhone: z.string().min(6).max(20),
  donorEmail: z.string().email(),
  donorAddress: z.string().min(2).max(300),
  donorCity: z.string().min(1).max(80),
  donorState: z.string().min(1).max(80),
  donorPinCode: z.string().min(3).max(12),
  bookTitle: z.string().min(1).max(200),
  bookAuthor: z.string().min(1).max(150),
  bookPublisher: z.string().max(150).optional().default(""),
  bookEdition: z.string().max(50).optional().default(""),
  bookIsbn: z.string().max(30).optional().default(""),
  bookSubject: z.string().max(100).optional().default(""),
  bookCategory: z.string().max(100).optional().default(""),
  bookAcademicLevel: z.string().max(100).optional().default(""),
  bookCondition: z.enum(BOOK_CONDITIONS),
  bookQuantity: z.coerce.number().int().min(1).max(500).optional().default(1),
  bookLanguage: z.string().max(60).optional().default(""),
  additionalNotes: z.string().max(1000).optional().default(""),
  consent: z.union([z.literal(true), z.literal("true")]).transform(() => true),
  deliveryMethod: z.enum(BOOK_DELIVERY_METHODS).refine((method) => method !== "not_specified"),
});

export const submitBookDonation = asyncHandler(async (req: Request, res: Response) => {
  const data = submitSchema.parse(req.body);
  if (!data.consent) {
    throw new ApiError(400, "Please confirm that you are willing to donate this book");
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    throw new ApiError(400, "Please upload at least one photo of the book");
  }
  const photos = files.map((f) => toPublicFile(f, req, "book-donations", isCloudinaryConfigured));
  if (data.donorDateOfBirth) {
    const dateOfBirth = new Date(`${data.donorDateOfBirth}T00:00:00.000Z`);
    if (
      Number.isNaN(dateOfBirth.getTime()) ||
      dateOfBirth.toISOString().slice(0, 10) !== data.donorDateOfBirth ||
      data.donorDateOfBirth > new Date().toISOString().slice(0, 10)
    ) {
      throw new ApiError(400, "Please provide a valid date of birth");
    }
  }

  const donation = await BookDonation.create({
    donor: {
      fullName: data.donorFullName,
      dateOfBirth: data.donorDateOfBirth,
      phone: data.donorPhone,
      email: data.donorEmail,
      address: data.donorAddress,
      city: data.donorCity,
      state: data.donorState,
      pinCode: data.donorPinCode,
    },
    book: {
      title: data.bookTitle,
      author: data.bookAuthor,
      publisher: data.bookPublisher,
      edition: data.bookEdition,
      isbn: data.bookIsbn,
      subject: data.bookSubject,
      category: data.bookCategory,
      academicLevel: data.bookAcademicLevel,
      condition: data.bookCondition,
      quantity: data.bookQuantity,
      language: data.bookLanguage,
    },
    photos,
    additionalNotes: data.additionalNotes,
    consent: data.consent,
    deliveryMethod: data.deliveryMethod,
  });

  res.status(201).json({ message: "Thank you — your book donation is pending review", donation });
});

// --- Admin ---

export const listBookDonations = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  const donations = await BookDonation.find(filter).sort({ createdAt: -1 });
  res.json({ donations });
});

export const countPendingBookDonations = asyncHandler(async (_req: Request, res: Response) => {
  const count = await BookDonation.countDocuments({ status: "pending_review" });
  res.json({ count });
});

const rejectSchema = z.object({ adminNote: z.string().max(500).optional() });

export const rejectBookDonation = asyncHandler(async (req: Request, res: Response) => {
  const { adminNote } = rejectSchema.parse(req.body ?? {});
  const donation = await BookDonation.findById(req.params.id);
  if (!donation) throw new ApiError(404, "Donation not found");
  if (donation.status !== "pending_review") throw new ApiError(400, "Only pending donations can be reviewed");

  donation.status = "rejected";
  if (adminNote) donation.adminNote = adminNote;
  await donation.save();
  res.json({ donation });
});

export const approveBookDonation = asyncHandler(async (req: Request, res: Response) => {
  const donation = await BookDonation.findById(req.params.id);
  if (!donation) throw new ApiError(404, "Donation not found");
  if (donation.status !== "pending_review") throw new ApiError(400, "Only pending donations can be reviewed");

  const category = await Category.findOneAndUpdate(
    { slug: slugify(PROJECT_CATEGORY_NAME) },
    { name: PROJECT_CATEGORY_NAME, slug: slugify(PROJECT_CATEGORY_NAME) },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const book = donation.book!;

  const description = [
    `Donated through Project Vidhyadhanam. This book is provided free of cost — only delivery charges apply.`,
    `Author: ${book.author}`,
    book.publisher ? `Publisher: ${book.publisher}` : "",
    book.edition ? `Edition: ${book.edition}` : "",
    book.subject || book.academicLevel ? `Subject: ${book.subject || "—"} · Level: ${book.academicLevel || "—"}` : "",
    `Condition: ${book.condition}`,
    book.language ? `Language: ${book.language}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const slug = slugify(book.title) + "-" + Math.random().toString(36).slice(2, 7);

  const product = await Product.create({
    name: book.title,
    slug,
    description,
    price: 0,
    category: category._id,
    images: donation.photos,
    stock: book.quantity,
    isFeatured: false,
    isActive: true,
    tags: ["project-vidhyadhanam", "donated-book"],
  });

  donation.status = "approved";
  donation.product = product._id;
  await donation.save();

  res.json({ donation, product });
});
