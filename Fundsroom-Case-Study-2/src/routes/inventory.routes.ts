import { Router } from "express";

import {
  getInventory,
  getInventoryByProduct,
  updateInventory,
} from "../controllers/inventory.controller";

import {
  authenticate,
  requireRole,
} from "../middleware/auth.middleware";

const router = Router();

// ADMIN and SALES can view inventory
router.get(
  "/",
  authenticate,
  requireRole("ADMIN", "SALES"),
  getInventory
);

// ADMIN and SALES can view one product's inventory
router.get(
  "/:productId",
  authenticate,
  requireRole("ADMIN", "SALES"),
  getInventoryByProduct
);

// Only ADMIN can update physical stock
router.patch(
  "/:productId",
  authenticate,
  requireRole("ADMIN"),
  updateInventory
);

export default router;