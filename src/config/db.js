import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import "dotenv/config";

const uri = process.env.MONGODB_BETTER_AUTH_URI || process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_BETTER_AUTH_URI or MONGODB_URI is not set in environment variables");
}

export const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

export const connectDB = async () => {
  await client.connect();
  db = client.db("pizzahub");
  console.log("Successfully connected to MongoDB Atlas!");
};

export const getDB = () => {
  if (!db) {
    throw new Error("Database not initialized. Call connectDB first.");
  }
  return db;
};

// Collections helpers
export const getCollections = () => {
  const database = getDB();
  return {
    usersCollection: database.collection("user"),
    sessionsCollection: database.collection("session"),
    menuItemsCollection: database.collection("menuItems"),
    vendorShopsCollection: database.collection("vendorShops"),
    ordersCollection: database.collection("orders"),
    transactionsCollection: database.collection("transactions"),
    vendorsCollection: database.collection("vendors"),
  };
};

// Helper to query documents by ID (supporting both ObjectId and string IDs)
export const toIdQuery = (id) => {
  if (!id) return { _id: null };
  const strId = String(id);
  if (ObjectId.isValid(strId)) {
    return {
      $or: [{ _id: new ObjectId(strId) }, { _id: strId }, { id: strId }],
    };
  }
  return { $or: [{ _id: strId }, { id: strId }] };
};
