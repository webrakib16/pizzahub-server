import { getCollections } from "../config/db.js";

// Vendor Dashboard Overview
export const getVendorOverview = async (req, res) => {
  try {
    const vendorId = req.user._id?.toString() || req.user.id;
    const vendorName = req.user.name || "";
    const vendorEmail = req.user.email;

    const { menuItemsCollection, ordersCollection } = getCollections();

    const [totalItems, activeItems, allOrders] = await Promise.all([
      menuItemsCollection.countDocuments({
        $or: [{ vendorId: String(vendorId) }, { vendorEmail }],
      }),
      menuItemsCollection.countDocuments({
        $or: [{ vendorId: String(vendorId) }, { vendorEmail }],
        isActive: true,
      }),
      ordersCollection.find({}).toArray(),
    ]);

    const vendorOrders = allOrders.filter((order) =>
      order.items?.some(
        (i) =>
          i.vendorId === String(vendorId) ||
          (i.vendorName && vendorName && i.vendorName.toLowerCase().includes(vendorName.toLowerCase()))
      )
    );

    const pendingOrders = vendorOrders.filter((o) => o.status === "pending").length;
    const acceptedOrders = vendorOrders.filter((o) => o.status === "accepted").length;

    res.send({
      totalMenuItems: totalItems,
      activeMenuItems: activeItems,
      pendingOrders,
      acceptedOrders,
      currentSubscriptionPlan: req.user.subscription || "free",
    });
  } catch (error) {
    console.error("getVendorOverview error:", error);
    res.status(500).send({ error: "Failed to fetch vendor overview" });
  }
};

// Admin Dashboard Overview
export const getAdminOverview = async (req, res) => {
  try {
    const { usersCollection, menuItemsCollection, ordersCollection, transactionsCollection } =
      getCollections();

    const [
      totalUsers,
      totalCustomers,
      totalVendors,
      blockedUsers,
      totalMenuItems,
      pendingMenuItems,
      totalOrders,
      transactions,
    ] = await Promise.all([
      usersCollection.countDocuments({}),
      usersCollection.countDocuments({ role: "customer" }),
      usersCollection.countDocuments({ role: "vendor" }),
      usersCollection.countDocuments({ blocked: true }),
      menuItemsCollection.countDocuments({}),
      menuItemsCollection.countDocuments({ status: "pending" }),
      ordersCollection.countDocuments({}),
      transactionsCollection.find({ status: "success" }).toArray(),
    ]);

    const totalRevenue = transactions.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    res.send({
      totalUsers,
      totalCustomers,
      totalVendors,
      blockedUsers,
      totalMenuItems,
      pendingMenuItems,
      totalOrders,
      totalTransactions: transactions.length,
      totalRevenue,
    });
  } catch (error) {
    console.error("getAdminOverview error:", error);
    res.status(500).send({ error: "Failed to fetch admin overview" });
  }
};

// Customer Dashboard Overview
export const getCustomerOverview = async (req, res) => {
  try {
    const userId = req.user._id?.toString() || req.user.id;
    const userEmail = req.user.email;

    const { ordersCollection } = getCollections();
    const userOrders = await ordersCollection
      .find({ $or: [{ userId }, { customerEmail: userEmail }] })
      .toArray();

    const totalOrders = userOrders.length;
    const pendingOrders = userOrders.filter((o) => o.status === "pending").length;
    const acceptedOrders = userOrders.filter((o) => o.status === "accepted").length;
    const cancelledOrders = userOrders.filter((o) => o.status === "cancelled").length;

    const totalSpent = userOrders
      .filter((o) => o.status === "accepted")
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    res.send({
      totalOrders,
      pendingOrders,
      acceptedOrders,
      cancelledOrders,
      totalSpent,
    });
  } catch (error) {
    console.error("getCustomerOverview error:", error);
    res.status(500).send({ error: "Failed to fetch customer overview" });
  }
};
