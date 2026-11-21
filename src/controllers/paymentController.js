import Stripe from "stripe";
import { ObjectId } from "mongodb";
import { getCollections, toIdQuery } from "../config/db.js";

const getStripeInstance = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured in environment variables.");
  }
  return new Stripe(secretKey);
};

// ─── 1. Create Stripe Checkout Session (Vendor Premium Subscription) ───────────
export const createCheckoutSession = async (req, res) => {
  try {
    const stripe = getStripeInstance();
    const clientUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.CLIENT_URL || "http://localhost:3000";

    const vendorId = req.user.id || req.user._id?.toString();
    const vendorName = req.user.name || "Vendor";
    const vendorEmail = req.user.email;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: vendorEmail,
      line_items: [
        {
          price_data: {
            currency: "bdt",
            product_data: {
              name: "PizzaHub Vendor Premium Plan",
              description:
                "Unlimited active menu items, priority admin review, and verified premium restaurant badge.",
            },
            unit_amount: 49900, // ৳499.00 BDT in poisha
          },
          quantity: 1,
        },
      ],
      metadata: {
        vendorId: String(vendorId),
        vendorName: String(vendorName),
        vendorEmail: String(vendorEmail),
        plan: "Premium",
      },
      success_url: `${clientUrl}/vendor/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/vendor/subscription/cancel`,
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("createCheckoutSession error:", error);
    res.status(500).json({
      error: "Failed to create checkout session",
      message: error.message || "An unexpected payment error occurred.",
    });
  }
};

// ─── 2. Get Vendor Subscription Status ─────────────────────────────────────────
export const getSubscriptionStatus = async (req, res) => {
  try {
    const vendorId = req.user.id || req.user._id?.toString();
    const { usersCollection, vendorShopsCollection } = getCollections();

    const user = await usersCollection.findOne(toIdQuery(vendorId));
    const shop = await vendorShopsCollection.findOne({ vendorId: String(vendorId) });

    const isPremium = Boolean(
      user?.isPremium === true ||
      user?.subscription === "premium" ||
      shop?.isPremium === true
    );

    res.status(200).json({
      isPremium,
      plan: isPremium ? "Premium" : "Free",
      premiumSince: user?.premiumSince || null,
    });
  } catch (error) {
    console.error("getSubscriptionStatus error:", error);
    res.status(500).json({ error: "Failed to fetch subscription status" });
  }
};

// ─── 3. Stripe Webhook Listener (Raw Body Verification) ─────────────────────────
export const handleStripeWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("❌ STRIPE_WEBHOOK_SECRET is missing. Cannot verify webhook signature.");
    return res.status(500).json({ error: "Webhook secret not configured on server." });
  }

  if (!signature) {
    console.error("❌ Missing stripe-signature header.");
    return res.status(400).json({ error: "Missing stripe-signature header." });
  }

  let event;
  try {
    const stripe = getStripeInstance();
    // Cryptographically verify signature using raw body buffer
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    console.error(`❌ Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle successful checkout event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const metadata = session.metadata || {};
    const vendorId = metadata.vendorId;
    const vendorName = metadata.vendorName || "Vendor";
    const vendorEmail = metadata.vendorEmail || session.customer_email;
    const plan = metadata.plan || "Premium";
    const amount = (session.amount_total || 49900) / 100;

    console.log(`💳 Webhook verified for Vendor [${vendorId}] - Plan: ${plan}, Amount: ৳${amount}`);

    if (!vendorId) {
      console.warn("⚠️ No vendorId found in checkout session metadata.");
      return res.status(200).json({ received: true, warning: "No vendorId in metadata" });
    }

    try {
      const {
        transactionsCollection,
        usersCollection,
        vendorShopsCollection,
        vendorsCollection,
      } = getCollections();

      // Idempotency: Prevent duplicate records if Stripe retries the webhook
      const existingTx = await transactionsCollection.findOne({
        stripeSessionId: session.id,
      });

      if (existingTx) {
        console.log(`ℹ️ Webhook event for session ${session.id} already processed. Skipping duplicate.`);
        return res.status(200).json({ received: true, duplicate: true });
      }

      // 1. Record the transaction in the 'transactions' collection
      await transactionsCollection.insertOne({
        vendorId: String(vendorId),
        vendorName: String(vendorName),
        vendorEmail: vendorEmail || null,
        plan,
        amount,
        currency: session.currency || "bdt",
        status: "success",
        paymentMethod: "stripe_card",
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent || null,
        createdAt: new Date(),
      });

      // 2. Update Vendor's user account with Premium status
      const userQuery = ObjectId.isValid(vendorId)
        ? { $or: [{ id: String(vendorId) }, { _id: new ObjectId(vendorId) }] }
        : { id: String(vendorId) };

      await usersCollection.updateOne(userQuery, {
        $set: {
          subscription: "premium",
          isPremium: true,
          premiumSince: new Date(),
          updatedAt: new Date(),
        },
      });

      // 3. Update Vendor's shop profile in 'vendorShops'
      if (vendorShopsCollection) {
        await vendorShopsCollection.updateOne(
          { vendorId: String(vendorId) },
          {
            $set: {
              isPremium: true,
              subscription: "premium",
              updatedAt: new Date(),
            },
          }
        );
      }

      // 4. Update 'vendors' collection if present
      if (vendorsCollection) {
        await vendorsCollection.updateOne(
          { $or: [{ vendorId: String(vendorId) }, { email: vendorEmail }] },
          {
            $set: {
              subscription: "premium",
              isPremium: true,
              updatedAt: new Date(),
            },
          }
        );
      }

      console.log(`✅ Vendor [${vendorId}] successfully upgraded to Premium in database!`);
    } catch (dbErr) {
      console.error("❌ Database error processing Stripe webhook:", dbErr);
      return res.status(500).json({ error: "Database update failed." });
    }
  }

  return res.status(200).json({ received: true });
};
