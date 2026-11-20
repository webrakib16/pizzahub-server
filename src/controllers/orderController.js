import { getCollections, toIdQuery } from "../config/db.js";

// Customer: Place order
export const createOrder = async (req, res) => {
  try {
    const user = req.user;
    const userId = user._id?.toString() || user.id;

    // Rule: Admins cannot place customer orders
    if (user.role === "admin") {
      return res.status(403).send({
        error: "Forbidden",
        message: "Admins cannot place customer orders.",
      });
    }

    const {
      items,
      subtotal,
      deliveryCharge,
      totalAmount,
      deliveryLocation,
      deliveryArea,
      deliveryAddress,
      deliveryDate,
      instructions,
      phone,
    } = req.body || {};

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).send({ error: "Order must contain at least one item." });
    }

    if (!deliveryAddress || !deliveryArea || !deliveryDate || !phone) {
      return res.status(400).send({
        error: "Delivery address, area, delivery date, and phone number are required.",
      });
    }

    const { menuItemsCollection, ordersCollection } = getCollections();

    // Verify rules for each item:
    // 1. Must be approved and active
    // 2. Vendors cannot order their own items
    for (const item of items) {
      const itemDoc = await menuItemsCollection.findOne(toIdQuery(item.menuItemId));
      if (!itemDoc) {
        return res.status(404).send({ error: `Item "${item.name || item.menuItemId}" not found.` });
      }

      if (itemDoc.status !== "approved" || !itemDoc.isActive) {
        return res.status(400).send({
          error: `"${itemDoc.name}" is currently unavailable or not approved for ordering.`,
        });
      }

      if (
        user.role === "vendor" &&
        (itemDoc.vendorId === userId || itemDoc.vendorEmail === user.email)
      ) {
        return res.status(403).send({
          error: `Vendors cannot order their own items (${itemDoc.name}).`,
        });
      }
    }

    const now = new Date();
    const newOrder = {
      userId,
      customerName: user.name || "Customer",
      customerEmail: user.email,
      phone,
      items,
      subtotal: Number(subtotal) || 0,
      deliveryCharge: Number(deliveryCharge) || 0,
      totalAmount: Number(totalAmount) || 0,
      deliveryLocation: deliveryLocation || "inside-dhaka",
      deliveryArea,
      deliveryAddress,
      deliveryDate,
      instructions: instructions || "",
      status: "pending", // Default status
      createdAt: now,
      updatedAt: now,
    };

    const result = await ordersCollection.insertOne(newOrder);
    res.status(201).send({
      success: true,
      message: "Order placed successfully",
      orderId: result.insertedId.toString(),
      order: { id: result.insertedId.toString(), ...newOrder },
    });
  } catch (error) {
    console.error("createOrder error:", error);
    res.status(500).send({ error: "Failed to place order" });
  }
};

// Customer: My orders
export const getCustomerOrders = async (req, res) => {
  try {
    const userId = req.user._id?.toString() || req.user.id;
    const userEmail = req.user.email;

    const { ordersCollection } = getCollections();
    const orders = await ordersCollection
      .find({ $or: [{ userId }, { customerEmail: userEmail }] })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(
      orders.map((o) => ({
        id: o._id.toString(),
        userId: o.userId,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        phone: o.phone,
        items: o.items || [],
        subtotal: o.subtotal,
        deliveryCharge: o.deliveryCharge,
        totalAmount: o.totalAmount,
        deliveryLocation: o.deliveryLocation,
        deliveryArea: o.deliveryArea,
        deliveryAddress: o.deliveryAddress,
        deliveryDate: o.deliveryDate,
        instructions: o.instructions,
        status: o.status,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      }))
    );
  } catch (error) {
    console.error("getCustomerOrders error:", error);
    res.status(500).send({ error: "Failed to fetch customer orders" });
  }
};

// Vendor: Customer orders for this restaurant
export const getVendorOrders = async (req, res) => {
  try {
    const vendorName = req.user.name || "";
    const vendorId = req.user._id?.toString() || req.user.id;

    const { ordersCollection } = getCollections();
    const allOrders = await ordersCollection.find({}).sort({ createdAt: -1 }).toArray();

    const filtered = allOrders.filter((order) =>
      order.items?.some(
        (item) =>
          (item.vendorId && String(item.vendorId) === String(vendorId)) ||
          (item.vendorName && vendorName && item.vendorName.toLowerCase().includes(vendorName.toLowerCase()))
      )
    );

    res.send(
      filtered.map((o) => ({
        id: o._id.toString(),
        userId: o.userId,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        phone: o.phone,
        items: o.items || [],
        subtotal: o.subtotal,
        deliveryCharge: o.deliveryCharge,
        totalAmount: o.totalAmount,
        deliveryLocation: o.deliveryLocation,
        deliveryArea: o.deliveryArea,
        deliveryAddress: o.deliveryAddress,
        deliveryDate: o.deliveryDate,
        instructions: o.instructions,
        status: o.status,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      }))
    );
  } catch (error) {
    console.error("getVendorOrders error:", error);
    res.status(500).send({ error: "Failed to fetch vendor orders" });
  }
};

// Customer: Cancel pending order
export const cancelOrder = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user._id?.toString() || req.user.id;

    const { ordersCollection } = getCollections();
    const order = await ordersCollection.findOne(toIdQuery(id));
    if (!order) return res.status(404).send({ error: "Order not found" });

    if (order.userId !== userId && order.customerEmail !== req.user.email) {
      return res.status(403).send({ error: "You can only cancel your own orders" });
    }

    if (order.status !== "pending") {
      return res.status(409).send({ error: "Only pending orders can be cancelled" });
    }

    await ordersCollection.updateOne(
      { ...toIdQuery(id), status: "pending" },
      { $set: { status: "cancelled", updatedAt: new Date() } }
    );

    res.send({ success: true, message: "Order cancelled successfully" });
  } catch (error) {
    console.error("cancelOrder error:", error);
    res.status(500).send({ error: "Failed to cancel order" });
  }
};

// Vendor: Accept or reject customer order
export const updateOrderStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;

    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).send({ error: "Status must be accepted or rejected" });
    }

    const { ordersCollection } = getCollections();
    const order = await ordersCollection.findOne(toIdQuery(id));
    if (!order) return res.status(404).send({ error: "Order not found" });

    if (order.status !== "pending") {
      return res.status(409).send({
        error: `Order has already been ${order.status} and cannot be modified`,
      });
    }

    await ordersCollection.updateOne(
      { ...toIdQuery(id), status: "pending" },
      { $set: { status, updatedAt: new Date() } }
    );

    res.send({ success: true, message: `Order ${status} successfully` });
  } catch (error) {
    console.error("updateOrderStatus error:", error);
    res.status(500).send({ error: "Failed to update order status" });
  }
};

// Get single order details
export const getOrderById = async (req, res) => {
  try {
    const id = req.params.id;
    const { ordersCollection } = getCollections();
    const order = await ordersCollection.findOne(toIdQuery(id));
    if (!order) return res.status(404).send({ error: "Order not found" });

    const userId = req.user._id?.toString() || req.user.id;
    const isOwner = order.userId === userId || order.customerEmail === req.user.email;
    const isAdmin = req.user.role === "admin";
    const isVendorOfItem = order.items?.some(
      (i) =>
        i.vendorId === userId ||
        (i.vendorName && req.user.name && i.vendorName.toLowerCase().includes(req.user.name.toLowerCase()))
    );

    if (!isOwner && !isAdmin && !isVendorOfItem) {
      return res.status(403).send({ error: "Unauthorized access to order details" });
    }

    res.send({
      id: order._id.toString(),
      userId: order.userId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      phone: order.phone,
      items: order.items || [],
      subtotal: order.subtotal,
      deliveryCharge: order.deliveryCharge,
      totalAmount: order.totalAmount,
      deliveryLocation: order.deliveryLocation,
      deliveryArea: order.deliveryArea,
      deliveryAddress: order.deliveryAddress,
      deliveryDate: order.deliveryDate,
      instructions: order.instructions,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });
  } catch (error) {
    console.error("getOrderById error:", error);
    res.status(500).send({ error: "Failed to fetch order details" });
  }
};

// Admin: View all orders
export const getAllOrders = async (req, res) => {
  try {
    const { ordersCollection } = getCollections();
    const orders = await ordersCollection.find({}).sort({ createdAt: -1 }).toArray();

    res.send(
      orders.map((o) => ({
        id: o._id.toString(),
        userId: o.userId,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        phone: o.phone,
        items: o.items || [],
        subtotal: o.subtotal,
        deliveryCharge: o.deliveryCharge,
        totalAmount: o.totalAmount,
        deliveryLocation: o.deliveryLocation,
        deliveryArea: o.deliveryArea,
        deliveryAddress: o.deliveryAddress,
        deliveryDate: o.deliveryDate,
        instructions: o.instructions,
        status: o.status,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      }))
    );
  } catch (error) {
    console.error("getAllOrders error:", error);
    res.status(500).send({ error: "Failed to fetch all orders" });
  }
};
