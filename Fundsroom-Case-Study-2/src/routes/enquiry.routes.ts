import { Router } from "express";

import {
  createEnquiry,
  getEnquiries,
  getEnquiryById,
  updateEnquiryStatus,
} from "../controllers/enquiry.controller";

import {
  authenticate,
  requireRole,
} from "../middleware/auth.middleware";

const router = Router();

// Create enquiry
router.post(
  "/",
  authenticate,
  requireRole("ADMIN", "SALES"),
  createEnquiry
);

// Get all enquiries
router.get(
  "/",
  authenticate,
  requireRole("ADMIN", "SALES"),
  getEnquiries
);

// Get enquiry by ID
router.get(
  "/:id",
  authenticate,
  requireRole("ADMIN", "SALES"),
  getEnquiryById
);

// Update enquiry status
router.patch(
  "/:id/status",
  authenticate,
  requireRole("ADMIN", "SALES"),
  updateEnquiryStatus
);

export default router;