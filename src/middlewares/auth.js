import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getCollections } from "../config/db.js";

// JWT verification middleware
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({
      error: "Unauthorized",
      message: "Access denied. No token provided.",
    });
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(
    token,
    process.env.ACCESS_TOKEN_SECRET || "pizzahub_jwt_secret_token_batch14_secure_key_2026",
    (err, decoded) => {
      if (err) {
        return res.status(401).send({
          error: "Unauthorized",
          message: "Invalid or expired token.",
        });
      }
      req.decoded = decoded;
      next();
    }
  );
};

// Blocked users verification middleware
export const verifyNotBlocked = async (req, res, next) => {
  try {
    const { usersCollection } = getCollections();
    const email = req.decoded?.email;
    const id = req.decoded?.id;

    const user = await usersCollection.findOne({
      $or: [
        ...(email ? [{ email }] : []),
        ...(id && ObjectId.isValid(id) ? [{ _id: new ObjectId(id) }] : []),
        ...(id ? [{ _id: String(id) }, { id: String(id) }] : []),
      ],
    });

    if (!user) {
      return res.status(404).send({
        error: "Not Found",
        message: "User not found in system.",
      });
    }

    if (user.blocked === true) {
      return res.status(403).send({
        error: "Forbidden",
        message: "Your account has been blocked by an administrator.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("verifyNotBlocked error:", error);
    res.status(500).send({ error: "Internal server error" });
  }
};

// Admin role check middleware
export const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).send({
      error: "Forbidden",
      message: "Forbidden access: Admin privileges required.",
    });
  }
  next();
};

// Vendor role check middleware
export const verifyVendor = (req, res, next) => {
  if (req.user?.role !== "vendor" && req.user?.role !== "admin") {
    return res.status(403).send({
      error: "Forbidden",
      message: "Forbidden access: Vendor privileges required.",
    });
  }
  next();
};
