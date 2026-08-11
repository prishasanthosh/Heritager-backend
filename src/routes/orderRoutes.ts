import { Router } from "express";
import {
  checkout,
  confirmZohoPayment,
  listAllOrders,
  myOrderById,
  myOrders,
  updateOrderStatus,
} from "../controllers/orderController.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.post("/checkout", checkout);
router.get("/mine", myOrders);
router.get("/mine/:id", myOrderById);
router.post("/:orderId/confirm-zoho-payment", confirmZohoPayment);

router.get("/", requireAdmin, listAllOrders);
router.patch("/:id/status", requireAdmin, updateOrderStatus);

export default router;
