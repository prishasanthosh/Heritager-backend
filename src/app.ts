import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { env } from "./config/env.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import donationRoutes from "./routes/donationRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import bookDonationRoutes from "./routes/bookDonationRoutes.js";
import bookRequestRoutes from "./routes/bookRequestRoutes.js";
import { contactRouter, newsletterRouter, volunteerRouter } from "./routes/engagementRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(morgan(env.isProd ? "combined" : "dev"));

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 600,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // Local fallback storage for uploads when Cloudinary isn't configured (see config/localUpload.ts).
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.get("/api/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

  app.use("/api/admin", adminRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/cart", cartRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/uploads", uploadRoutes);
  app.use("/api/donations", donationRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/book-donations", bookDonationRoutes);
  app.use("/api/book-requests", bookRequestRoutes);
  app.use("/api/contact", contactRouter);
  app.use("/api/volunteer-applications", volunteerRouter);
  app.use("/api/newsletter", newsletterRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
