import { ObjectId } from "mongodb";
import { getCollections, toIdQuery } from "../config/db.js";

// Public: Browse Menu (Used by FeaturedMenuItems, PizzaCategories, Explore Menu)
// Query params: ?limit=6, ?category=Classic Pizza, ?exclude=itemId, ?location=Dhaka, ?search=...
export const getPublicMenu = async (req, res) => {
  try {
    const { search, category, location, exclude, limit, sort } = req.query;
    const query = { status: "approved", isActive: true };

    if (category && category !== "all") {
      query.category = { $regex: new RegExp(`^${category}$`, "i") };
    }
    if (location && location !== "all") {
      query.location = { $regex: location, $options: "i" };
    }
    if (exclude) {
      if (ObjectId.isValid(exclude)) {
        query._id = { $nin: [new ObjectId(exclude), String(exclude)] };
      } else {
        query._id = { $ne: String(exclude) };
      }
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    let sortOptions = { createdAt: -1 };
    if (sort === "price-low") sortOptions = { price: 1 };
    else if (sort === "price-high") sortOptions = { price: -1 };
    else if (sort === "oldest") sortOptions = { createdAt: 1 };

    const { menuItemsCollection } = getCollections();
    let cursor = menuItemsCollection.find(query).sort(sortOptions);

    if (limit && !isNaN(Number(limit))) {
      cursor = cursor.limit(Number(limit));
    }

    const items = await cursor.toArray();

    res.json(
      items.map((item) => ({
        id: item._id.toString(),
        vendorId: item.vendorId,
        vendorName: item.vendorName,
        name: item.name,
        category: item.category,
        description: item.description,
        price: item.price,
        location: item.location,
        image: item.primaryImage || item.image,
        primaryImage: item.primaryImage || item.image,
        images: item.images?.length ? item.images : [item.primaryImage || item.image],
        status: item.status,
        isActive: item.isActive,
        createdAt: item.createdAt,
      }))
    );
  } catch (error) {
    console.error("getPublicMenu error:", error);
    res.status(500).json({ error: "Failed to fetch menu items" });
  }
};

// Public: Item Details (Product Details page)
export const getMenuItemById = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || (typeof id === "string" && id.length !== 24 && !ObjectId.isValid(id))) {
      return res.status(400).json({ error: "Invalid menu item ID format" });
    }

    const { menuItemsCollection, vendorShopsCollection, usersCollection } = getCollections();
    const item = await menuItemsCollection.findOne(toIdQuery(id));
    if (!item) return res.status(404).json({ error: "Menu item not found" });

    // Look up shop info
    const shop = await vendorShopsCollection.findOne({
      $or: [{ vendorId: String(item.vendorId) }, { vendorId: item.vendorId }],
    });
    const vendor = await usersCollection.findOne(toIdQuery(item.vendorId));

    res.json({
      id: item._id.toString(),
      vendorId: item.vendorId,
      vendorName: shop?.shopName || item.vendorName,
      vendorEmail: vendor?.email,
      vendorPremium: vendor?.subscription === "premium",
      shopBio: shop?.shopBio || "",
      shopLogo: shop?.shopLogo || "",
      shopLocation: shop?.shopLocation || item.location,
      name: item.name,
      category: item.category,
      description: item.description,
      price: item.price,
      location: item.location,
      image: item.primaryImage || item.image,
      primaryImage: item.primaryImage || item.image,
      images: item.images?.length ? item.images : [item.primaryImage || item.image],
      status: item.status,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  } catch (error) {
    console.error("getMenuItemById error:", error);
    res.status(500).json({ error: "Failed to fetch item details" });
  }
};

// Vendor: My Menu Items (Vendor dashboard menu list)
export const getVendorMenuItems = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const vendorEmail = req.user.email;

    const { menuItemsCollection } = getCollections();
    const items = await menuItemsCollection
      .find({
        $or: [
          { vendorId: String(vendorId) },
          { vendorId: vendorId },
          { vendorEmail: vendorEmail },
        ],
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(
      items.map((doc) => ({
        id: doc._id.toString(),
        vendorId: doc.vendorId,
        vendorName: doc.vendorName,
        name: doc.name,
        category: doc.category,
        description: doc.description,
        price: doc.price,
        location: doc.location,
        image: doc.primaryImage || doc.image,
        primaryImage: doc.primaryImage || doc.image,
        images: doc.images?.length ? doc.images : [doc.primaryImage || doc.image],
        status: doc.status,
        isActive: doc.isActive ?? true,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }))
    );
  } catch (error) {
    console.error("getVendorMenuItems error:", error);
    res.status(500).json({ error: "Failed to fetch vendor menu" });
  }
};

// Vendor: Create Menu Item
// Critical rules from AGENTS.md:
// 1. Shop profile gate: vendorShops profile must be complete
// 2. Free plan limit: count(vendorId, isActive: true) < 3
// 3. Shop name: always use shopName from vendorShops, never user.name
export const createMenuItem = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const vendorEmail = req.user.email;
    const isPremium = req.user.subscription === "premium";

    const { vendorShopsCollection, menuItemsCollection } = getCollections();

    // 1. Shop profile gate
    const shop = await vendorShopsCollection.findOne({ vendorId: String(vendorId) });
    if (!shop || !shop.isProfileComplete) {
      return res.status(400).json({
        error: "Complete your shop profile before adding menu items",
      });
    }

    const { name, category, description, price, location, image, primaryImage, images } =
      req.body || {};

    if (!name || !category || !description || price === undefined || !location) {
      return res.status(400).json({
        error: "All fields are required: name, category, description, price, and location",
      });
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      return res.status(400).json({ error: "Price must be a positive number" });
    }

    const resolvedImages = Array.isArray(images) && images.length > 0
      ? images.map(String).filter((u) => Boolean(u.trim()))
      : [];
    const resolvedPrimary = String(primaryImage || image || resolvedImages[0] || "").trim();

    if (!resolvedPrimary) {
      return res.status(400).json({ error: "Item Image is required" });
    }

    const finalImages = resolvedImages.length > 0
      ? [resolvedPrimary, ...resolvedImages.filter((img) => img !== resolvedPrimary)]
      : [resolvedPrimary];

    // 2. Free plan limit: max 3 active items
    if (!isPremium) {
      const activeCount = await menuItemsCollection.countDocuments({
        $or: [
          { vendorId: String(vendorId) },
          { vendorId: vendorId },
          { vendorEmail: vendorEmail },
        ],
        isActive: true,
      });

      if (activeCount >= 3) {
        return res.status(400).json({
          error: "Free plan limit reached (max 3 active items). Upgrade to Premium to publish unlimited items.",
        });
      }
    }

    const now = new Date();
    // 3. Shop name on items: always read shopName from vendorShops
    const newMenuItem = {
      vendorId: String(vendorId),
      vendorName: shop.shopName,
      vendorEmail,
      name: String(name).trim(),
      category: String(category).trim(),
      description: String(description).trim(),
      price: numPrice,
      location: String(location).trim(),
      primaryImage: resolvedPrimary,
      image: resolvedPrimary,
      images: finalImages,
      status: "pending", // Default Pending until Admin approves
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const result = await menuItemsCollection.insertOne(newMenuItem);
    res.status(201).json({
      success: true,
      message: "Menu item created successfully and pending admin approval",
      item: { id: result.insertedId.toString(), ...newMenuItem },
    });
  } catch (error) {
    console.error("createMenuItem error:", error);
    res.status(500).json({ error: "Failed to create menu item" });
  }
};

// Vendor: Update Menu Item
// Critical rule: Strip admin-only fields (status, isActive) before updating
export const updateMenuItem = async (req, res) => {
  try {
    const id = req.params.id;
    const vendorId = req.user.id;
    const isAdmin = req.user.role === "admin";

    const { menuItemsCollection } = getCollections();
    const existing = await menuItemsCollection.findOne(toIdQuery(id));
    if (!existing) return res.status(404).json({ error: "Menu item not found" });

    if (!isAdmin && existing.vendorId !== String(vendorId) && existing.vendorEmail !== req.user.email) {
      return res.status(403).json({ error: "Unauthorized: You can only update your own items" });
    }

    const body = req.body || {};
    // Strip admin-only fields if not admin
    if (!isAdmin) {
      delete body.status;
      delete body.isActive;
    }

    const { name, category, description, price, location, image, primaryImage, images, isActive } =
      body;

    const updateData = { updatedAt: new Date() };
    if (name) updateData.name = String(name).trim();
    if (category) updateData.category = String(category).trim();
    if (description) updateData.description = String(description).trim();
    if (price !== undefined) {
      const numPrice = Number(price);
      if (numPrice <= 0) return res.status(400).json({ error: "Price must be positive" });
      updateData.price = numPrice;
    }
    if (location) updateData.location = String(location).trim();
    if (image || primaryImage) {
      const pImg = primaryImage || image;
      updateData.primaryImage = pImg;
      updateData.image = pImg;
    }
    if (Array.isArray(images) && images.length > 0) updateData.images = images;
    if (isAdmin && typeof isActive === "boolean") updateData.isActive = isActive;

    await menuItemsCollection.updateOne(toIdQuery(id), { $set: updateData });
    res.json({ success: true, message: "Menu item updated successfully" });
  } catch (error) {
    console.error("updateMenuItem error:", error);
    res.status(500).json({ error: "Failed to update item" });
  }
};

// Vendor: Availability Toggle
export const toggleAvailability = async (req, res) => {
  try {
    const id = req.params.id;
    const { isActive } = req.body;
    const vendorId = req.user.id;
    const isPremium = req.user.subscription === "premium";

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ error: "isActive (boolean) is required" });
    }

    const { menuItemsCollection } = getCollections();
    const existing = await menuItemsCollection.findOne(toIdQuery(id));
    if (!existing) return res.status(404).json({ error: "Menu item not found" });

    if (existing.vendorId !== String(vendorId) && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: You can only update your own items" });
    }

    if (isActive && !isPremium) {
      const activeCount = await menuItemsCollection.countDocuments({
        vendorId: String(vendorId),
        isActive: true,
        _id: { $ne: existing._id },
      });

      if (activeCount >= 3) {
        return res.status(400).json({
          error: "Free plan limit reached (max 3 active items). Upgrade to Premium to activate more items.",
        });
      }
    }

    await menuItemsCollection.updateOne(toIdQuery(id), { $set: { isActive, updatedAt: new Date() } });
    res.json({ success: true, message: `Item availability set to ${isActive ? "active" : "inactive"}` });
  } catch (error) {
    console.error("toggleAvailability error:", error);
    res.status(500).json({ error: "Failed to update availability" });
  }
};

// Vendor: Delete Menu Item
export const deleteMenuItem = async (req, res) => {
  try {
    const id = req.params.id;
    const vendorId = req.user.id;
    const isAdmin = req.user.role === "admin";

    const { menuItemsCollection } = getCollections();
    const existing = await menuItemsCollection.findOne(toIdQuery(id));
    if (!existing) return res.status(404).json({ error: "Menu item not found" });

    if (!isAdmin && existing.vendorId !== String(vendorId) && existing.vendorEmail !== req.user.email) {
      return res.status(403).json({ error: "Unauthorized: You can only delete your own items" });
    }

    await menuItemsCollection.deleteOne(toIdQuery(id));
    res.json({ success: true, message: "Menu item deleted successfully" });
  } catch (error) {
    console.error("deleteMenuItem error:", error);
    res.status(500).json({ error: "Failed to delete menu item" });
  }
};

// Admin: Get all items
export const getAdminMenu = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status && status !== "all") query.status = status;

    const { menuItemsCollection } = getCollections();
    const items = await menuItemsCollection.find(query).sort({ createdAt: -1 }).toArray();

    res.json(
      items.map((doc) => ({
        id: doc._id.toString(),
        vendorId: doc.vendorId,
        vendorName: doc.vendorName,
        vendorEmail: doc.vendorEmail,
        name: doc.name,
        category: doc.category,
        description: doc.description,
        price: doc.price,
        location: doc.location,
        image: doc.primaryImage || doc.image,
        images: doc.images || [doc.primaryImage || doc.image],
        status: doc.status,
        isActive: doc.isActive ?? true,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }))
    );
  } catch (error) {
    console.error("getAdminMenu error:", error);
    res.status(500).json({ error: "Failed to fetch admin menu items" });
  }
};

// Admin: Approve / Reject Menu Item
// Critical rule: Also sets isActive: status === "approved"
export const updateItemStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ error: "Status must be approved, rejected, or pending" });
    }

    const { menuItemsCollection } = getCollections();
    await menuItemsCollection.updateOne(
      toIdQuery(id),
      {
        $set: {
          status,
          isActive: status === "approved",
          updatedAt: new Date(),
        },
      }
    );

    res.json({ success: true, message: `Menu item status updated to ${status}` });
  } catch (error) {
    console.error("updateItemStatus error:", error);
    res.status(500).json({ error: "Failed to update item status" });
  }
};
