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
router.post("/users", saveUser);

// User profile & role
router.get("/users/me", verifyToken, verifyNotBlocked, getMyProfile);
router.get("/users/role/:email", verifyToken, getUserRole);
router.patch("/users/profile", verifyToken, verifyNotBlocked, updateProfile);

// Admin user management
router.get("/users", verifyToken, verifyNotBlocked, verifyAdmin, getAllUsers);
router.patch("/users/:id/block", verifyToken, verifyNotBlocked, verifyAdmin, toggleBlockUser);
router.patch("/users/:id/role", verifyToken, verifyNotBlocked, verifyAdmin, updateUserRole);

// Also mount direct admin routes as specified in AGENTS.md
router.get("/admin/users", verifyToken, verifyNotBlocked, verifyAdmin, getAllUsers);
router.patch("/admin/users/:id/block", verifyToken, verifyNotBlocked, verifyAdmin, toggleBlockUser);

export default router;
