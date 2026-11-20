import { getCollections } from "../config/db.js";

// Public: List vendors (Restaurants)
// Vendors with Premium subscriptions receive featured placement and badge
export const getVendors = async (req, res) => {
  try {
    const { usersCollection } = getCollections();
    const vendors = await usersCollection
      .find({ role: "vendor" })
      .project({ name: 1, email: 1, image: 1, subscription: 1, createdAt: 1 })
      .toArray();

    const formatted = vendors.map((v) => ({
      id: v._id.toString(),
      name: v.name,
      email: v.email,
      image: v.image || "",
      isPremium: v.subscription === "premium",
      badge: v.subscription === "premium" ? "Premium" : "Standard",
    }));

    // Premium vendors get featured placement first
    formatted.sort((a, b) => (b.isPremium ? 1 : 0) - (a.isPremium ? 1 : 0));

    res.send(formatted);
  } catch (error) {
    console.error("getVendors error:", error);
    res.status(500).send({ error: "Failed to fetch vendors" });
  }
};
