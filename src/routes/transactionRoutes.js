import express from "express";
import {
  upgradeSubscription,
  getAllTransactions,
  getVendorTransactions,
} from "../controllers/transactionController.js";
import {
  verifyToken,
  verifyNotBlocked,
  verifyVendor,
  verifyAdmin,
} from "../middlewares/auth.js";

const router = express.Router();

router.post("/subscription/upgrade", verifyToken, verifyNotBlocked, verifyVendor, upgradeSubscription);
router.get("/transactions", verifyToken, verifyNotBlocked, verifyAdmin, getAllTransactions);
router.get("/transactions/vendor", verifyToken, verifyNotBlocked, verifyVendor, getVendorTransactions);

export default router;
