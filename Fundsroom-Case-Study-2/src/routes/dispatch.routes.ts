import { Router } from "express";

import {
  createDispatch,
  getDispatches,
  getDispatchById,
} from "../controllers/dispatch.controller";

import {
  authenticate,
  requireRole,
} from "../middleware/auth.middleware";

const router = Router();

// ======================================================
// CREATE DISPATCH
// ADMIN ONLY
// ======================================================

router.post(
  "/sales-orders/:id/dispatch",
  authenticate,
  requireRole("ADMIN"),
  createDispatch
);

// ======================================================
// GET ALL DISPATCHES
// ADMIN ONLY
// ======================================================

router.get(
  "/",
  authenticate,
  requireRole("ADMIN"),
  getDispatches
);

// ======================================================
// GET DISPATCH BY ID
// ADMIN ONLY
// ======================================================

router.get(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  getDispatchById
);

export default router;