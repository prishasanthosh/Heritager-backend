import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { cloudinary } from "../config/cloudinary.js";
import { isCloudinaryConfigured } from "../config/env.js";
import { createLocalDiskStorage } from "../config/localUpload.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import {
  approveBookDonation,
  listBookDonations,
  rejectBookDonation,
  submitBookDonation,
} from "../controllers/bookDonationController.js";

const router = Router();

const submitLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

const storage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary,
      params: async () => ({
        folder: "heritage-heart/book-donations",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        transformation: [{ width: 1600, height: 1600, crop: "limit" }],
      }),
    })
  : createLocalDiskStorage("book-donations");

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024, files: 5 } });

router.post("/", submitLimiter, upload.array("photos", 5), submitBookDonation);

router.get("/", requireAuth, requireAdmin, listBookDonations);
router.patch("/:id/approve", requireAuth, requireAdmin, approveBookDonation);
router.patch("/:id/reject", requireAuth, requireAdmin, rejectBookDonation);

export default router;
