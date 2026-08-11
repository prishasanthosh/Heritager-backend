import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  confirmDonationPayment,
  createDonation,
  getDonation,
  listDonations,
  markDonationPaid,
} from "../controllers/donationController.js";
import { optionalAuth, requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

const donateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

// Donors don't have to be signed in, but if they are we tag the donation to their account.
router.post("/", donateLimiter, optionalAuth, createDonation);
router.get("/:id", getDonation);
router.post("/:id/confirm-zoho-payment", confirmDonationPayment);

router.get("/", requireAuth, requireAdmin, listDonations);
router.patch("/:id/mark-paid", requireAuth, requireAdmin, markDonationPaid);

export default router;
