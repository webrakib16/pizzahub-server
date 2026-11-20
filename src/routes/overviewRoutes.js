import express from "express";
import {
  getVendorOverview,
  getAdminOverview,
  getCustomerOverview,
} from "../controllers/overviewController.js";
import {
  verifyToken,
  verifyNotBlocked,
  verifyVendor,
  verifyAdmin,
} from "../middlewares/auth.js";

const router = express.Router();

router.get("/vendor", verifyToken, verifyNotBlocked, verifyVendor, getVendorOverview);
router.get("/admin", verifyToken, verifyNotBlocked, verifyAdmin, getAdminOverview);
router.get("/customer", verifyToken, verifyNotBlocked, getCustomerOverview);

export default router;
