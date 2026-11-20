import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getCollections } from "../config/db.js";

export const createToken = async (req, res) => {
  try {
    const { email, id } = req.body || {};
    if (!email && !id) {
      return res.status(400).send({ error: "Email or ID is required" });
    }

    const { usersCollection } = getCollections();
    const user = await usersCollection.findOne({
      $or: [
        ...(email ? [{ email }] : []),
        ...(id && ObjectId.isValid(id) ? [{ _id: new ObjectId(id) }] : []),
        ...(id ? [{ _id: String(id) }, { id: String(id) }] : []),
      ],
    });

    const payload = {
      email: user?.email || email,
      id: user?._id?.toString() || user?.id || id,
      role: user?.role || "customer",
      blocked: user?.blocked || false,
    };

    const token = jwt.sign(
      payload,
      process.env.ACCESS_TOKEN_SECRET || "pizzahub_jwt_secret_token_batch14_secure_key_2026",
      { expiresIn: "7d" }
    );

    res.send({ success: true, token, user: payload });
  } catch (error) {
    console.error("createToken error:", error);
    res.status(500).send({ error: "Failed to generate token" });
  }
};
