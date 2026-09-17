import { Router } from "express";

import {
  convertQuotationToSalesOrder,
  getSalesOrders,
  getSalesOrderById,
  confirmSalesOrder,
  cancelSalesOrder,
} from "../controllers/salesOrder.controller";

import {
  authenticate,
  requireRole,
} from "../middleware/auth.middleware";

const router = Router();

// ======================================================
// CONVERT QUOTATION → SALES ORDER
// ======================================================

router.post(
  "/from-quotation/:id",
  authenticate,
  requireRole("ADMIN", "SALES"),
  convertQuotationToSalesOrder
);

// ======================================================
// GET ALL SALES ORDERS
// ======================================================

router.get(
  "/",
  authenticate,
  requireRole("ADMIN", "SALES"),
  getSalesOrders
);

// ======================================================
// GET SALES ORDER BY ID
// ======================================================

router.get(
  "/:id",
  authenticate,
  requireRole("ADMIN", "SALES"),
  getSalesOrderById
);

// ======================================================
// CONFIRM SALES ORDER + RESERVE INVENTORY
// ADMIN ONLY
// ======================================================

router.post(
  "/:id/confirm",
  authenticate,
  requireRole("ADMIN"),
  confirmSalesOrder
);

// ======================================================
// CANCEL SALES ORDER
// ADMIN ONLY
// ======================================================

router.patch(
  "/:id/cancel",
  authenticate,
  requireRole("ADMIN"),
  cancelSalesOrder
);

export default router;