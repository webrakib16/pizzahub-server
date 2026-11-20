import express from "express";
import {
  saveUser,
  getMyProfile,
  getUserRole,
  getAllUsers,
  toggleBlockUser,
  updateUserRole,
  updateProfile,
} from "../controllers/userController.js";
import {
  verifyToken,
  verifyNotBlocked,
  verifyAdmin,
} from "../middlewares/auth.js";

const router = express.Router();

// Public / Auth sync
router.post("/", saveUser);

// User profile & role
router.get("/me", verifyToken, verifyNotBlocked, getMyProfile);
router.get("/role/:email", verifyToken, getUserRole);
router.patch("/profile", verifyToken, verifyNotBlocked, updateProfile);

// Admin user management
router.get("/", verifyToken, verifyNotBlocked, verifyAdmin, getAllUsers);
router.patch("/:id/block", verifyToken, verifyNotBlocked, verifyAdmin, toggleBlockUser);
router.patch("/:id/role", verifyToken, verifyNotBlocked, verifyAdmin, updateUserRole);

export default router;
