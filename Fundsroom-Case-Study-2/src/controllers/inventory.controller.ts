import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export async function getInventory(
  _req: Request,
  res: Response
) {
  try {
    const inventory = await prisma.inventory.findMany({
      include: {
        product: true,
      },
      orderBy: {
        product: {
          code: "asc",
        },
      },
    });

    const result = inventory.map((item) => ({
      id: item.id,
      productId: item.productId,
      product: item.product,
      physicalQuantity: item.physicalQuantity,
      reservedQuantity: item.reservedQuantity,
      availableQuantity:
        item.physicalQuantity - item.reservedQuantity,
    }));

    return res.status(200).json({
      inventory: result,
    });
  } catch (error) {
    console.error("Get inventory error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function getInventoryByProduct(
  req: Request,
  res: Response
) {
  try {
    const productId = Number(req.params.productId);

    if (!Number.isInteger(productId)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    const inventory = await prisma.inventory.findUnique({
      where: {
        productId,
      },
      include: {
        product: true,
      },
    });

    if (!inventory) {
      return res.status(404).json({
        message: "Inventory record not found",
      });
    }

    return res.status(200).json({
      inventory: {
        id: inventory.id,
        productId: inventory.productId,
        product: inventory.product,
        physicalQuantity: inventory.physicalQuantity,
        reservedQuantity: inventory.reservedQuantity,
        availableQuantity:
          inventory.physicalQuantity -
          inventory.reservedQuantity,
      },
    });
  } catch (error) {
    console.error(
      "Get inventory by product error:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function updateInventory(
  req: Request,
  res: Response
) {
  try {
    const productId = Number(req.params.productId);
    const { physicalQuantity } = req.body;

    if (!Number.isInteger(productId)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    if (
      physicalQuantity === undefined ||
      physicalQuantity === null
    ) {
      return res.status(400).json({
        message: "Physical quantity is required",
      });
    }

    const newPhysicalQuantity = Number(
      physicalQuantity
    );

    if (
      !Number.isInteger(newPhysicalQuantity) ||
      newPhysicalQuantity < 0
    ) {
      return res.status(400).json({
        message:
          "Physical quantity must be a non-negative whole number",
      });
    }

    const inventory = await prisma.inventory.findUnique({
      where: {
        productId,
      },
    });

    if (!inventory) {
      return res.status(404).json({
        message: "Inventory record not found",
      });
    }

    // Physical stock can never be less than already reserved stock.
    if (
      newPhysicalQuantity <
      inventory.reservedQuantity
    ) {
      return res.status(400).json({
        message:
          "Physical quantity cannot be less than reserved quantity",
      });
    }

    const updatedInventory =
      await prisma.inventory.update({
        where: {
          productId,
        },
        data: {
          physicalQuantity: newPhysicalQuantity,
        },
        include: {
          product: true,
        },
      });

    return res.status(200).json({
      message: "Inventory updated successfully",
      inventory: {
        id: updatedInventory.id,
        productId: updatedInventory.productId,
        product: updatedInventory.product,
        physicalQuantity:
          updatedInventory.physicalQuantity,
        reservedQuantity:
          updatedInventory.reservedQuantity,
        availableQuantity:
          updatedInventory.physicalQuantity -
          updatedInventory.reservedQuantity,
      },
    });
  } catch (error) {
    console.error("Update inventory error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}