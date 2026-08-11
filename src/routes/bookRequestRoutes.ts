import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { cloudinary } from "../config/cloudinary.js";
import { isCloudinaryConfigured } from "../config/env.js";
import { createLocalDiskStorage } from "../config/localUpload.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { listBookRequests, submitBookRequest, updateBookRequestStatus } from "../controllers/bookRequestController.js";

const router = Router();

const submitLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

const storage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary,
      params: async () => ({
        folder: "heritage-heart/book-requests",
        resource_type: "auto",
        allowed_formats: ["jpg", "jpeg", "png", "webp", "pdf"],
      }),
    })
  : createLocalDiskStorage("book-requests");

const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024, files: 2 } });

router.post(
  "/",
  submitLimiter,
  upload.fields([
    { name: "studentIdDocument", maxCount: 1 },
    { name: "supportingDocument", maxCount: 1 },
  ]),
  submitBookRequest
);

router.get("/", requireAuth, requireAdmin, listBookRequests);
router.patch("/:id/status", requireAuth, requireAdmin, updateBookRequestStatus);

export default router;
