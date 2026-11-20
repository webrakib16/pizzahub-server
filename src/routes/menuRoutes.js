import express from "express";
import {
  getPublicMenu,
  getMenuItemById,
  getVendorMenuItems,
  createMenuItem,
  updateMenuItem,
  toggleAvailability,
  deleteMenuItem,
  getAdminMenu,
  updateItemStatus,
} from "../controllers/menuController.js";
import {
  verifyToken,
  verifyNotBlocked,
  verifyVendor,
  verifyAdmin,
} from "../middlewares/auth.js";

const router = express.Router();

// Public
router.get("/menu", getPublicMenu);
router.get("/menu/:id", getMenuItemById);

// Vendor
router.get("/vendor/menu", verifyToken, verifyNotBlocked, verifyVendor, getVendorMenuItems);
router.post("/menu", verifyToken, verifyNotBlocked, verifyVendor, createMenuItem);
router.patch("/menu/:id", verifyToken, verifyNotBlocked, verifyVendor, updateMenuItem);
router.patch("/menu/:id/availability", verifyToken, verifyNotBlocked, verifyVendor, toggleAvailability);
router.delete("/menu/:id", verifyToken, verifyNotBlocked, verifyVendor, deleteMenuItem);

// Admin
router.get("/admin/menu", verifyToken, verifyNotBlocked, verifyAdmin, getAdminMenu);
router.patch("/admin/menu/:id/status", verifyToken, verifyNotBlocked, verifyAdmin, updateItemStatus);

export default router;
