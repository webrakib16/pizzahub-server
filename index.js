import express from "express";
import cors from "cors";
import "dotenv/config";
import { connectDB } from "./src/config/db.js";

import authRoutes from "./src/routes/authRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import menuRoutes from "./src/routes/menuRoutes.js";
import orderRoutes from "./src/routes/orderRoutes.js";
import transactionRoutes from "./src/routes/transactionRoutes.js";
import overviewRoutes from "./src/routes/overviewRoutes.js";
import vendorRoutes from "./src/routes/vendorRoutes.js";

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());

// API Routes
app.use("/", authRoutes);
app.use("/users", userRoutes);
app.use("/", menuRoutes);
app.use("/", orderRoutes);
app.use("/", transactionRoutes);
app.use("/overview", overviewRoutes);
app.use("/", vendorRoutes);

// Root Health Check
app.get("/", (req, res) => {
  res.send({
    message: "PizzaHub Backend API Server is running smoothly",
    version: "1.0.0",
    status: "healthy",
  });
});

// 404 Handler for undefined routes
app.use((req, res) => {
  res.status(404).send({
    error: "Route Not Found",
    message: `The endpoint ${req.method} ${req.url} does not exist on this server.`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).send({
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
