import type { Request, Response } from "express";
import { z } from "zod";
import { BookRequest, BOOK_REQUEST_STATUSES } from "../models/BookRequest.js";
import { isCloudinaryConfigured } from "../config/env.js";
import { toPublicFile } from "../config/localUpload.js";
import { asyncHandler, ApiError } from "../utils/asyncHandler.js";

const submitSchema = z.object({
  studentFullName: z.string().min(2).max(100),
  studentEmail: z.string().email(),
  studentPhone: z.string().min(6).max(20),
  studentAddress: z.string().min(2).max(300),
  institutionName: z.string().min(2).max(150),
  courseClass: z.string().min(1).max(100),
  yearSemester: z.string().min(1).max(50),
  bookName: z.string().min(1).max(200),
  bookAuthor: z.string().max(150).optional().default(""),
  bookSubject: z.string().min(1).max(100),
  bookEdition: z.string().max(50).optional().default(""),
  quantityRequired: z.coerce.number().int().min(1).max(50),
  reason: z.string().min(10).max(1000),
});

export const submitBookRequest = asyncHandler(async (req: Request, res: Response) => {
  const data = submitSchema.parse(req.body);

  const files = (req.files as Record<string, Express.Multer.File[]> | undefined) ?? {};
  const studentIdFile = files.studentIdDocument?.[0];
  const supportingFile = files.supportingDocument?.[0];

  if (!studentIdFile) {
    throw new ApiError(400, "Student ID document is required");
  }

  const toDoc = (f: Express.Multer.File) => toPublicFile(f, req, "book-requests", isCloudinaryConfigured);

  const request = await BookRequest.create({
    student: {
      fullName: data.studentFullName,
      email: data.studentEmail,
      phone: data.studentPhone,
      address: data.studentAddress,
      institutionName: data.institutionName,
      courseClass: data.courseClass,
      yearSemester: data.yearSemester,
    },
    book: {
      name: data.bookName,
      author: data.bookAuthor,
      subject: data.bookSubject,
      edition: data.bookEdition,
      quantityRequired: data.quantityRequired,
    },
    reason: data.reason,
    studentIdDocument: toDoc(studentIdFile),
    supportingDocument: supportingFile ? toDoc(supportingFile) : undefined,
  });

  res.status(201).json({ message: "Your book request has been submitted for review", request });
});

// --- Admin ---

export const listBookRequests = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  const requests = await BookRequest.find(filter).sort({ createdAt: -1 });
  res.json({ requests });
});

const statusSchema = z.object({ status: z.enum(BOOK_REQUEST_STATUSES), adminNote: z.string().max(500).optional() });

export const updateBookRequestStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status, adminNote } = statusSchema.parse(req.body);
  const request = await BookRequest.findById(req.params.id);
  if (!request) throw new ApiError(404, "Request not found");

  request.status = status;
  if (adminNote) request.adminNote = adminNote;
  await request.save();
  res.json({ request });
});
