import { Router } from "express";

import {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotationStatus,
} from "../controllers/quotation.controller";

import {
  authenticate,
  requireRole,
} from "../middleware/auth.middleware";

const router = Router();

// Create quotation
router.post(
  "/",
  authenticate,
  requireRole("ADMIN", "SALES"),
  createQuotation
);

// Get all quotations
router.get(
  "/",
  authenticate,
  requireRole("ADMIN", "SALES"),
  getQuotations
);

// Get quotation by ID
router.get(
  "/:id",
  authenticate,
  requireRole("ADMIN", "SALES"),
  getQuotationById
);

// Update quotation status
router.patch(
  "/:id/status",
  authenticate,
  requireRole("ADMIN", "SALES"),
  updateQuotationStatus
);

export default router;