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

// Public Menu (both /menu/public and /menu formats)
router.get("/menu/public", getPublicMenu);
router.get("/menu/public/:id", getMenuItemById);
router.get("/menu", getPublicMenu);
router.get("/menu/:id", getMenuItemById);

// Vendor Menu
router.get("/vendor/menu", verifyToken, verifyNotBlocked, verifyVendor, getVendorMenuItems);
router.post("/vendor/menu", verifyToken, verifyNotBlocked, verifyVendor, createMenuItem);
router.patch("/vendor/menu/:id", verifyToken, verifyNotBlocked, verifyVendor, updateMenuItem);
router.delete("/vendor/menu/:id", verifyToken, verifyNotBlocked, verifyVendor, deleteMenuItem);
router.patch("/vendor/menu/:id/availability", verifyToken, verifyNotBlocked, verifyVendor, toggleAvailability);

// Backward-compatible vendor routes
router.post("/menu", verifyToken, verifyNotBlocked, verifyVendor, createMenuItem);
router.patch("/menu/:id", verifyToken, verifyNotBlocked, verifyVendor, updateMenuItem);
router.delete("/menu/:id", verifyToken, verifyNotBlocked, verifyVendor, deleteMenuItem);
router.patch("/menu/:id/availability", verifyToken, verifyNotBlocked, verifyVendor, toggleAvailability);

// Admin Menu
router.get("/admin/menu", verifyToken, verifyNotBlocked, verifyAdmin, getAdminMenu);
router.patch("/admin/menu/:id/status", verifyToken, verifyNotBlocked, verifyAdmin, updateItemStatus);

export default router;
