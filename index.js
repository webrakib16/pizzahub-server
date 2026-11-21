import express from "express";
import cors from "cors";
import "dotenv/config";
import { connectDB } from "./src/config/db.js";

import authRoutes from "./src/routes/authRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import menuRoutes from "./src/routes/menuRoutes.js";
import orderRoutes from "./src/routes/orderRoutes.js";
import vendorShopRoutes from "./src/routes/vendorShopRoutes.js";
import transactionRoutes from "./src/routes/transactionRoutes.js";
import overviewRoutes from "./src/routes/overviewRoutes.js";
import vendorRoutes from "./src/routes/vendorRoutes.js";

const app = express();

// CORS configuration (supports localhost:3000, Vercel deployments, credentials: true)
const allowedOrigins = [
  "http://localhost:3000",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json());

// Mount routers under both /api and / for full compatibility with AGENTS.md specs and direct calls
const routeList = [
  authRoutes,
  userRoutes,
  menuRoutes,
  orderRoutes,
  vendorShopRoutes,
  transactionRoutes,
  overviewRoutes,
  vendorRoutes,
];

routeList.forEach((router) => {
  app.use("/api", router);
  app.use("/", router);
});

// Root Health Check
app.get("/", (req, res) => {
  res.json({
    message: "PizzaHub Backend API Server is running smoothly",
    version: "1.0.0",
    status: "healthy",
  });
});

// 404 Handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    error: "Route Not Found",
    message: `The endpoint ${req.method} ${req.url} does not exist on this server.`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message || "An unexpected error occurred.",
  });
});

const port = process.env.PORT || 5000;

// Connect to MongoDB and start server
connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to database:", err);
    process.exit(1);
  });
