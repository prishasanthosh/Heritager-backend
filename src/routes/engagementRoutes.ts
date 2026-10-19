import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  listContactMessages,
  listNewsletterSubscribers,
  listVolunteerApplications,
  subscribeNewsletter,
  submitContact,
  submitVolunteerApplication,
  updateContactStatus,
  updateNewsletterSubscriberStatus,
  updateVolunteerStatus,
} from "../controllers/engagementController.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const contactRouter = Router();
contactRouter.post("/", publicFormLimiter, submitContact);
contactRouter.get("/", requireAuth, requireAdmin, listContactMessages);
contactRouter.patch("/:id/status", requireAuth, requireAdmin, updateContactStatus);

const volunteerRouter = Router();
volunteerRouter.post("/", publicFormLimiter, submitVolunteerApplication);
volunteerRouter.get("/", requireAuth, requireAdmin, listVolunteerApplications);
volunteerRouter.patch("/:id/status", requireAuth, requireAdmin, updateVolunteerStatus);

const newsletterRouter = Router();
newsletterRouter.post("/", publicFormLimiter, subscribeNewsletter);
newsletterRouter.get("/", requireAuth, requireAdmin, listNewsletterSubscribers);
newsletterRouter.patch("/:id/status", requireAuth, requireAdmin, updateNewsletterSubscriberStatus);

export { contactRouter, volunteerRouter, newsletterRouter };
