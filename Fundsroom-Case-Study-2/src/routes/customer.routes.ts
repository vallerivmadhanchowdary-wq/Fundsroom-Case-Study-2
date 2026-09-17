import { Router } from "express";

import {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
} from "../controllers/customer.controller";

import {
  authenticate,
  requireRole,
} from "../middleware/auth.middleware";

const router = Router();

router.post(
  "/",
  authenticate,
  requireRole("ADMIN", "SALES"),
  createCustomer
);

router.get(
  "/",
  authenticate,
  requireRole("ADMIN", "SALES"),
  getCustomers
);

router.get(
  "/:id",
  authenticate,
  requireRole("ADMIN", "SALES"),
  getCustomerById
);

router.patch(
  "/:id",
  authenticate,
  requireRole("ADMIN", "SALES"),
  updateCustomer
);

router.delete(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  deleteCustomer
);

export default router;