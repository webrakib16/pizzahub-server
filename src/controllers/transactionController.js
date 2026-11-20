import { getCollections, toIdQuery } from "../config/db.js";

// Vendor: Upgrade subscription to Premium
export const upgradeSubscription = async (req, res) => {
  try {
    const vendorId = req.user._id?.toString() || req.user.id;
    const vendorName = req.user.name || "Vendor";
    const vendorEmail = req.user.email;
    const { amount = 500, paymentMethod = "card" } = req.body || {};

    const { transactionsCollection, usersCollection, vendorsCollection } = getCollections();

    // Record transaction
    const transactionDoc = {
      vendorId: String(vendorId),
      vendorName,
      vendorEmail,
      plan: "premium",
      amount: Number(amount) || 500,
      paymentMethod,
      status: "success",
      createdAt: new Date(),
    };

    const transResult = await transactionsCollection.insertOne(transactionDoc);

    // Update vendor subscription to premium
    await usersCollection.updateOne(
      toIdQuery(vendorId),
      { $set: { subscription: "premium", updatedAt: new Date() } }
    );

    // Update vendors collection if present
    await vendorsCollection.updateOne(
      { $or: [{ vendorId: String(vendorId) }, { email: vendorEmail }] },
      { $set: { subscription: "premium", isPremium: true, updatedAt: new Date() } },
      { upsert: false }
    );

    res.send({
      success: true,
      message: "Successfully upgraded to Premium plan! You can now publish unlimited items with a Premium badge.",
      transactionId: transResult.insertedId.toString(),
      plan: "premium",
    });
  } catch (error) {
    console.error("upgradeSubscription error:", error);
    res.status(500).send({ error: "Failed to process upgrade" });
  }
};

// Admin: View platform transactions
export const getAllTransactions = async (req, res) => {
  try {
    const { transactionsCollection } = getCollections();
    const transactions = await transactionsCollection.find({}).sort({ createdAt: -1 }).toArray();

    res.send(
      transactions.map((t) => ({
        id: t._id.toString(),
        vendorId: t.vendorId,
        vendorName: t.vendorName,
        vendorEmail: t.vendorEmail,
        plan: t.plan,
        amount: t.amount,
        status: t.status,
        paymentMethod: t.paymentMethod || "card",
        createdAt: t.createdAt,
      }))
    );
  } catch (error) {
    console.error("getAllTransactions error:", error);
    res.status(500).send({ error: "Failed to fetch transactions" });
  }
};

// Vendor: View own transactions
export const getVendorTransactions = async (req, res) => {
  try {
    const vendorId = req.user._id?.toString() || req.user.id;
    const vendorEmail = req.user.email;

    const { transactionsCollection } = getCollections();
    const transactions = await transactionsCollection
      .find({
        $or: [{ vendorId: String(vendorId) }, { vendorEmail }],
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(
      transactions.map((t) => ({
        id: t._id.toString(),
        plan: t.plan,
        amount: t.amount,
        status: t.status,
        createdAt: t.createdAt,
      }))
    );
  } catch (error) {
    console.error("getVendorTransactions error:", error);
    res.status(500).send({ error: "Failed to fetch vendor transactions" });
  }
};
