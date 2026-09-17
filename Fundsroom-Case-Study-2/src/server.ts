import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes";
import enquiryRoutes from "./routes/enquiry.routes";
import inventoryRoutes from "./routes/inventory.routes";
import quotationRoutes from "./routes/quotation.routes";
import salesOrderRoutes from "./routes/salesOrder.routes";
import dispatchRoutes from "./routes/dispatch.routes";

import {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
} from "./controllers/customer.controller";

import {
  authenticate,
  requireRole,
} from "./middleware/auth.middleware";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

/* ROOT */

app.get("/", (_req, res) => {
  res.status(200).json({
    message: "Fundsroom Case Study 2 API is running",
  });
});

/* AUTH */

app.use("/api/auth", authRoutes);

/* CUSTOMERS */

app.get(
  "/api/customers",
  authenticate,
  requireRole("ADMIN", "SALES"),
  getCustomers
);

app.post(
  "/api/customers",
  authenticate,
  requireRole("ADMIN", "SALES"),
  createCustomer
);

app.get(
  "/api/customers/:id",
  authenticate,
  requireRole("ADMIN", "SALES"),
  getCustomerById
);

app.patch(
  "/api/customers/:id",
  authenticate,
  requireRole("ADMIN", "SALES"),
  updateCustomer
);

app.delete(
  "/api/customers/:id",
  authenticate,
  requireRole("ADMIN"),
  deleteCustomer
);

/* ENQUIRIES */

app.use("/api/enquiries", enquiryRoutes);

/* INVENTORY */

app.use("/api/inventory", inventoryRoutes);

/* QUOTATIONS */

app.use("/api/quotations", quotationRoutes);

/* SALES ORDERS */

app.use("/api/sales-orders", salesOrderRoutes);

/* DISPATCH */

app.use("/api", dispatchRoutes);

/* 404 */

app.use((req, res) => {
  console.log("404 REQUEST:", req.method, req.originalUrl);

  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
  });
});

/* ERROR */

app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("SERVER ERROR:", error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
);

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log("=================================");
  console.log("FUNDSROOM BACKEND STARTED");
  console.log(`PORT: ${PORT}`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log("=================================");
});