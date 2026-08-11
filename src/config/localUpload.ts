import fs from "fs";
import path from "path";
import type { Request } from "express";
import multer from "multer";

/**
 * When Cloudinary isn't configured (e.g. local dev without keys), uploads
 * still need to work end-to-end — so we fall back to writing files to a
 * local `uploads/<subfolder>` directory served statically from `/uploads`,
 * instead of silently producing broken URLs.
 */
export function createLocalDiskStorage(subfolder: string) {
  const dir = path.join(process.cwd(), "uploads", subfolder);
  fs.mkdirSync(dir, { recursive: true });

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  });
}

type UploadedFile = Express.Multer.File & { path: string; filename: string };

export function toPublicFile(file: Express.Multer.File, req: Request, subfolder: string, cloudinaryConfigured: boolean) {
  const f = file as UploadedFile;
  if (cloudinaryConfigured) {
    // multer-storage-cloudinary sets `.path` to the Cloudinary secure_url
    // and `.filename` to the Cloudinary public_id.
    return { url: f.path, publicId: f.filename };
  }
  return {
    url: `${req.protocol}://${req.get("host")}/uploads/${subfolder}/${f.filename}`,
    publicId: f.filename,
  };
}
