import express from "express";
import {
  getVendorShop,
  createVendorShop,
  updateVendorShop,
  getPublicVendor,
} from "../controllers/vendorShopController.js";
import { verifyToken, verifyVendor } from "../middlewares/auth.js";

const router = express.Router();

// Vendor Shop Profile (auth required — vendor only)
router.get("/vendor/shop", verifyToken, verifyVendor, getVendorShop);
router.post("/vendor/shop", verifyToken, verifyVendor, createVendorShop);
router.patch("/vendor/shop", verifyToken, verifyVendor, updateVendorShop);

// Public vendor info (no auth)
router.get("/vendor/:vendorId", getPublicVendor);

export default router;
