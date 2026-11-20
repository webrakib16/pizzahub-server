import express from "express";
import { getVendors } from "../controllers/vendorController.js";

const router = express.Router();

router.get("/vendors", getVendors);

export default router;
