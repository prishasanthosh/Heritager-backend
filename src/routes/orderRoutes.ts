import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  checkout,
  confirmZohoPayment,
  listAllOrders,
  myOrderById,
  myOrders,
  updateOrderStatus,
  zohoPaymentReturn,
  zohoPaymentWebhook,
} from "../controllers/orderController.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

const paymentCallbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/:orderId/zoho-callback", paymentCallbackLimiter, zohoPaymentReturn);
router.post("/zoho-webhook", paymentCallbackLimiter, zohoPaymentWebhook);

router.use(requireAuth);

router.post("/checkout", checkout);
router.get("/mine", myOrders);
router.get("/mine/:id", myOrderById);
router.post("/:orderId/confirm-zoho-payment", confirmZohoPayment);

router.get("/", requireAdmin, listAllOrders);
router.patch("/:id/status", requireAdmin, updateOrderStatus);

export default router;
