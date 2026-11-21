import express from "express";
import {
  createCheckoutSession,
  getSubscriptionStatus,
  handleStripeWebhook,
} from "../controllers/paymentController.js";
import {
  verifyToken,
  verifyNotBlocked,
  verifyVendor,
} from "../middlewares/auth.js";

const router = express.Router();

// Vendor Stripe Checkout Session
router.post(
  "/vendor/subscription/checkout",
  verifyToken,
  verifyNotBlocked,
  verifyVendor,
  createCheckoutSession
);

// Vendor Subscription Status Check
router.get(
  "/vendor/subscription/status",
  verifyToken,
  verifyNotBlocked,
  verifyVendor,
  getSubscriptionStatus
);

// Stripe Webhook Endpoint (also mounted directly with express.raw in index.js)
router.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

export default router;
