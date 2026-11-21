import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getCollections } from "../config/db.js";

// Helper to parse cookies from raw Cookie header
const parseCookies = (cookieHeader) => {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts[0]?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.slice(1).join("=").trim());
    }
  });
  return list;
};

// Auth middleware: supports Better Auth session token (cookie or header) and JWT token
export const verifyToken = async (req, res, next) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token =
      cookies["better-auth.session_token"] ||
      req.headers.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Access denied. No session or authentication token provided.",
      });
    }

    const { sessionsCollection, usersCollection } = getCollections();

    // 1. Try Better Auth session in MongoDB
    const session = await sessionsCollection.findOne({ token });
    if (session) {
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        return res.status(401).json({ error: "Session expired", message: "Session expired" });
      }

      const user = await usersCollection.findOne({
        $or: [
          { id: session.userId },
          ...(ObjectId.isValid(session.userId) ? [{ _id: new ObjectId(session.userId) }] : []),
          { _id: String(session.userId) },
        ],
      });

      if (!user) {
        return res.status(401).json({ error: "Unauthorized", message: "User not found" });
      }

      if (user.blocked) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Your account has been blocked by an administrator.",
        });
      }

      req.user = {
        id: user.id || user._id?.toString(),
        name: user.name,
        email: user.email,
        role: user.role || "customer",
        blocked: user.blocked || false,
        subscription: user.subscription || "free",
      };
      req.decoded = req.user;
      return next();
    }

    // 2. Try JWT token
    jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET || "pizzahub_jwt_secret_token_batch14_secure_key_2026",
      async (err, decoded) => {
        if (err) {
          return res.status(401).json({
            error: "Unauthorized",
            message: "Invalid or expired session token.",
          });
        }

        const user = await usersCollection.findOne({
          $or: [
            ...(decoded.email ? [{ email: decoded.email }] : []),
            ...(decoded.id && ObjectId.isValid(decoded.id) ? [{ _id: new ObjectId(decoded.id) }] : []),
            ...(decoded.id ? [{ _id: String(decoded.id) }, { id: String(decoded.id) }] : []),
          ],
        });

        if (!user) {
          return res.status(401).json({ error: "Unauthorized", message: "User not found" });
        }

        if (user.blocked) {
          return res.status(403).json({
            error: "Forbidden",
            message: "Your account has been blocked by an administrator.",
          });
        }

        req.user = {
          id: user.id || user._id?.toString(),
          name: user.name,
          email: user.email,
          role: user.role || "customer",
          blocked: user.blocked || false,
          subscription: user.subscription || "free",
        };
        req.decoded = req.user;
        next();
      }
    );
  } catch (error) {
    console.error("verifyToken error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Blocked users verification middleware
export const verifyNotBlocked = async (req, res, next) => {
  if (req.user?.blocked) {
    return res.status(403).json({
      error: "Forbidden",
      message: "Your account has been blocked by an administrator.",
    });
  }
  next();
};

// Admin role check middleware
export const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      error: "Forbidden",
      message: "Forbidden access: Admin privileges required.",
    });
  }
  next();
};

// Vendor role check middleware
export const verifyVendor = (req, res, next) => {
  if (req.user?.role !== "vendor" && req.user?.role !== "admin") {
    return res.status(403).json({
      error: "Forbidden",
      message: "Forbidden access: Vendor privileges required.",
    });
  }
  next();
};
