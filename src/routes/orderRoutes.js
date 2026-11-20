import express from "express";
import {
  createOrder,
  getCustomerOrders,
  getVendorOrders,
  cancelOrder,
  updateOrderStatus,
  getOrderById,
  getAllOrders,
} from "../controllers/orderController.js";
import {
  verifyToken,
  verifyNotBlocked,
  verifyVendor,
  verifyAdmin,
} from "../middlewares/auth.js";

const router = express.Router();

// Customer
router.post("/orders", verifyToken, verifyNotBlocked, createOrder);
router.get("/orders/customer", verifyToken, verifyNotBlocked, getCustomerOrders);
router.patch("/orders/:id/cancel", verifyToken, verifyNotBlocked, cancelOrder);

// Vendor
router.get("/vendor/orders", verifyToken, verifyNotBlocked, verifyVendor, getVendorOrders);
router.patch("/orders/:id/status", verifyToken, verifyNotBlocked, verifyVendor, updateOrderStatus);

// Common / Admin
router.get("/orders/:id", verifyToken, verifyNotBlocked, getOrderById);
router.get("/admin/orders", verifyToken, verifyNotBlocked, verifyAdmin, getAllOrders);

export default router;
