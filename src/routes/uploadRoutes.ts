import { Router } from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { cloudinary } from "../config/cloudinary.js";
import { isCloudinaryConfigured } from "../config/env.js";
import { createLocalDiskStorage, toPublicFile } from "../config/localUpload.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { asyncHandler, ApiError } from "../utils/asyncHandler.js";

const router = Router();

const storage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary,
      params: async () => ({
        folder: "heritage-heart/products",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        transformation: [{ width: 1600, height: 1600, crop: "limit" }],
      }),
    })
  : createLocalDiskStorage("products");

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.post(
  "/image",
  requireAuth,
  requireAdmin,
  upload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "No image file provided");
    const { url, publicId } = toPublicFile(req.file, req, "products", isCloudinaryConfigured);
    res.status(201).json({ url, publicId });
  })
);

export default router;
