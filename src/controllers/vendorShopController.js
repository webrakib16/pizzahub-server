import { getCollections, toIdQuery } from "../config/db.js";

// GET /api/vendor/shop — return current vendor's vendorShops document
export const getVendorShop = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { vendorShopsCollection } = getCollections();

    const shop = await vendorShopsCollection.findOne({ vendorId: String(vendorId) });
    if (!shop) {
      return res.status(404).json({ error: "Shop profile not found" });
    }

    res.json(shop);
  } catch (error) {
    console.error("getVendorShop error:", error);
    res.status(500).json({ error: "Failed to fetch vendor shop profile" });
  }
};

// POST /api/vendor/shop — create vendorShops document (first time setup)
export const createVendorShop = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { shopName, shopBio, shopLogo, shopLocation } = req.body || {};

    if (!shopName || !shopBio || !shopLocation) {
      return res.status(400).json({
        error: "shopName, shopBio, and shopLocation are required to complete shop profile",
      });
    }

    const { vendorShopsCollection } = getCollections();
    const existing = await vendorShopsCollection.findOne({ vendorId: String(vendorId) });
    if (existing) {
      return res.status(400).json({ error: "Shop profile already exists for this vendor" });
    }

    const now = new Date();
    const doc = {
      vendorId: String(vendorId),
      shopName: String(shopName).trim(),
      shopBio: String(shopBio).trim(),
      shopLogo: String(shopLogo || "").trim(),
      shopLocation: String(shopLocation).trim(),
      isProfileComplete: Boolean(shopName && shopBio && shopLocation),
      createdAt: now,
      updatedAt: now,
    };

    await vendorShopsCollection.insertOne(doc);
    res.status(201).json(doc);
  } catch (error) {
    console.error("createVendorShop error:", error);
    res.status(500).json({ error: "Failed to create shop profile" });
  }
};

// PATCH /api/vendor/shop — update shopName, shopBio, shopLogo, shopLocation
export const updateVendorShop = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { shopName, shopBio, shopLogo, shopLocation } = req.body || {};

    const { vendorShopsCollection, menuItemsCollection } = getCollections();
    const existing = await vendorShopsCollection.findOne({ vendorId: String(vendorId) });

    const updateFields = { updatedAt: new Date() };
    if (shopName !== undefined) updateFields.shopName = String(shopName).trim();
    if (shopBio !== undefined) updateFields.shopBio = String(shopBio).trim();
    if (shopLogo !== undefined) updateFields.shopLogo = String(shopLogo).trim();
    if (shopLocation !== undefined) updateFields.shopLocation = String(shopLocation).trim();

    const finalShopName = updateFields.shopName ?? existing?.shopName;
    const finalShopBio = updateFields.shopBio ?? existing?.shopBio;
    const finalShopLocation = updateFields.shopLocation ?? existing?.shopLocation;

    updateFields.isProfileComplete = Boolean(
      finalShopName && finalShopBio && finalShopLocation
    );

    const result = await vendorShopsCollection.findOneAndUpdate(
      { vendorId: String(vendorId) },
      { $set: updateFields },
      { returnDocument: "after", upsert: true }
    );

    // If shopName was updated, update vendorName in vendor's existing menu items
    if (shopName && existing?.shopName !== shopName) {
      await menuItemsCollection.updateMany(
        { vendorId: String(vendorId) },
        { $set: { vendorName: String(shopName).trim(), updatedAt: new Date() } }
      );
    }

    res.json(result);
  } catch (error) {
    console.error("updateVendorShop error:", error);
    res.status(500).json({ error: "Failed to update shop profile" });
  }
};

// GET /api/vendor/:vendorId — Public vendor shop info (About Vendor section)
export const getPublicVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { vendorShopsCollection, usersCollection } = getCollections();

    const shop = await vendorShopsCollection.findOne({
      $or: [{ vendorId: String(vendorId) }, { vendorId: vendorId }],
    });

    if (shop) {
      return res.json({
        vendorId: shop.vendorId,
        shopName: shop.shopName,
        shopBio: shop.shopBio,
        shopLogo: shop.shopLogo || "",
        shopLocation: shop.shopLocation,
        isProfileComplete: shop.isProfileComplete ?? true,
      });
    }

    // Fallback to user document if shop profile not yet initialized
    const user = await usersCollection.findOne(toIdQuery(vendorId));

    if (!user) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    res.json({
      vendorId: user.id || user._id?.toString(),
      shopName: user.name || "Pizza Hub Partner",
      shopBio: "Delicious handcrafted pizzas made fresh daily.",
      shopLogo: user.image || "",
      shopLocation: "Dhaka",
      isProfileComplete: false,
    });
  } catch (error) {
    console.error("getPublicVendor error:", error);
    res.status(500).json({ error: "Failed to fetch vendor info" });
  }
};
