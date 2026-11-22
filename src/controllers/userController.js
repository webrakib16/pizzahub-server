import { getCollections, toIdQuery } from "../config/db.js";

// Upsert user upon sign-in/up.
export const saveUser = async (req, res) => {
  try {
    const { name, email, role, image } = req.body || {};
    if (!email) return res.status(400).send({ error: "Email is required" });

    const { usersCollection } = getCollections();
    const existing = await usersCollection.findOne({ email });
    if (existing) {
      return res.send({ message: "User already exists", user: existing });
    }

    const newUser = {
      name: name || "Anonymous User",
      email,
      role: role === "vendor" ? "vendor" : role === "admin" ? "admin" : "customer",
      blocked: false,
      subscription: "free",
      image: image || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);
    res.status(201).send({ success: true, insertedId: result.insertedId, user: newUser });
  } catch (error) {
    console.error("saveUser error:", error);
    res.status(500).send({ error: "Failed to save user" });
  }
};

// Current user profile
export const getMyProfile = async (req, res) => {
  res.send({
    id: req.user._id?.toString() || req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    blocked: req.user.blocked || false,
    subscription: req.user.subscription || "free",
    image: req.user.image,
    createdAt: req.user.createdAt,
  });
};

// User role check
export const getUserRole = async (req, res) => {
  try {
    const email = req.params.email;
    if (req.decoded.email !== email && req.decoded.role !== "admin") {
      return res.status(403).send({ error: "Forbidden access" });
    }

    const { usersCollection } = getCollections();
    const user = await usersCollection.findOne({ email });
    if (!user) return res.status(404).send({ error: "User not found" });

    res.send({
      role: user.role || "customer",
      blocked: user.blocked || false,
      subscription: user.subscription || "free",
    });
  } catch (error) {
    console.error("getUserRole error:", error);
    res.status(500).send({ error: "Failed to fetch user role" });
  }
};

// Admin: Get all users
export const getAllUsers = async (req, res) => {
  try {
    const { search, role } = req.query;
    const query = {};
    if (role && role !== "all") query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const { usersCollection } = getCollections();
    const users = await usersCollection.find(query).sort({ createdAt: -1 }).toArray();
    res.send(
      users.map((u) => ({
        id: u._id?.toString() || u.id,
        name: u.name || "",
        email: u.email || "",
        role: u.role || "customer",
        blocked: u.blocked || false,
        subscription: u.subscription || "free",
        image: u.image || "",
        createdAt: u.createdAt || "",
      }))
    );
  } catch (error) {
    console.error("getAllUsers error:", error);
    res.status(500).send({ error: "Failed to fetch users" });
  }
};

// Admin: Block / unblock user
export const toggleBlockUser = async (req, res) => {
  try {
    const id = req.params.id;
    const { blocked } = req.body;
    if (typeof blocked !== "boolean") {
      return res.status(400).send({ error: "blocked property (boolean) is required" });
    }

    const { usersCollection } = getCollections();
    const target = await usersCollection.findOne(toIdQuery(id));
    if (!target) return res.status(404).send({ error: "User not found" });
    if (target.email === req.user.email) {
      return res.status(400).send({ error: "Admins cannot block their own account" });
    }

    await usersCollection.updateOne(toIdQuery(id), { $set: { blocked, updatedAt: new Date() } });
    res.send({ success: true, message: `User ${blocked ? "blocked" : "unblocked"} successfully` });
  } catch (error) {
    console.error("toggleBlockUser error:", error);
    res.status(500).send({ error: "Failed to update block status" });
  }
};

// Admin: Change user role
export const updateUserRole = async (req, res) => {
  try {
    const id = req.params.id;
    const { role } = req.body;
    if (!["customer", "vendor", "admin"].includes(role)) {
      return res.status(400).send({ error: "Role must be customer, vendor, or admin" });
    }

    const { usersCollection } = getCollections();
    await usersCollection.updateOne(toIdQuery(id), { $set: { role, updatedAt: new Date() } });
    res.send({ success: true, message: `User role updated to ${role}` });
  } catch (error) {
    console.error("updateUserRole error:", error);
    res.status(500).send({ error: "Failed to update role" });
  }
};

// Update profile
export const updateProfile = async (req, res) => {
  try {
    const { name, image, phone, address } = req.body || {};
    const updateData = { updatedAt: new Date() };
    if (name) updateData.name = name;
    if (image) updateData.image = image;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;

    const { usersCollection } = getCollections();
    await usersCollection.updateOne(toIdQuery(req.user._id || req.user.id), { $set: updateData });
    res.send({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    console.error("updateProfile error:", error);
    res.status(500).send({ error: "Failed to update profile" });
  }
};
