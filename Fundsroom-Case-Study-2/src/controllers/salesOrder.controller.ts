import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

function generateOrderNumber(): string {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const random = Math.floor(1000 + Math.random() * 9000);

  return `SO-${year}${month}${day}-${random}`;
}

// ======================================================
// CONVERT ACCEPTED QUOTATION TO SALES ORDER
// ======================================================

export async function convertQuotationToSalesOrder(
  req: Request,
  res: Response
) {
  try {
    const quotationId = Number(req.params.id);

    if (!Number.isInteger(quotationId)) {
      return res.status(400).json({
        message: "Invalid quotation ID",
      });
    }

    const quotation = await prisma.quotation.findUnique({
      where: {
        id: quotationId,
      },
      include: {
        customer: true,
        enquiry: true,
        items: {
          include: {
            product: true,
          },
        },
        salesOrder: true,
      },
    });

    if (!quotation) {
      return res.status(404).json({
        message: "Quotation not found",
      });
    }

    if (quotation.status !== "ACCEPTED") {
      return res.status(400).json({
        message:
          "Only an ACCEPTED quotation can be converted into a Sales Order",
      });
    }

    if (quotation.salesOrder) {
      return res.status(409).json({
        message:
          "This quotation has already been converted into a Sales Order",
        salesOrder: quotation.salesOrder,
      });
    }

    if (quotation.items.length === 0) {
      return res.status(400).json({
        message: "Quotation must contain at least one item",
      });
    }

    const salesOrder = await prisma.$transaction(async (tx) => {
      let orderNumber = generateOrderNumber();

      while (
        await tx.salesOrder.findUnique({
          where: {
            orderNumber,
          },
        })
      ) {
        orderNumber = generateOrderNumber();
      }

      const createdOrder = await tx.salesOrder.create({
        data: {
          orderNumber,
          quotationId: quotation.id,
          customerId: quotation.customerId,
          totalAmount: quotation.totalAmount,
          status: "PENDING",
          createdById: req.user!.userId,
        },
      });

      await tx.salesOrderItem.createMany({
        data: quotation.items.map((item) => ({
          salesOrderId: createdOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });

      return createdOrder;
    });

    const completeOrder = await prisma.salesOrder.findUnique({
      where: {
        id: salesOrder.id,
      },
      include: {
        customer: true,
        quotation: {
          include: {
            enquiry: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return res.status(201).json({
      message: "Sales Order created successfully",
      salesOrder: completeOrder,
    });
  } catch (error: any) {
    console.error("Convert quotation error:", error);

    if (error?.code === "P2002") {
      return res.status(409).json({
        message:
          "This quotation has already been converted into a Sales Order",
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

// ======================================================
// GET ALL SALES ORDERS
// ======================================================

export async function getSalesOrders(
  _req: Request,
  res: Response
) {
  try {
    const salesOrders = await prisma.salesOrder.findMany({
      include: {
        customer: true,

        quotation: {
          include: {
            enquiry: true,
          },
        },

        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },

        items: {
          include: {
            product: true,
          },
        },

        dispatch: true,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      salesOrders,
    });
  } catch (error) {
    console.error("Get sales orders error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

// ======================================================
// GET SALES ORDER BY ID
// ======================================================

export async function getSalesOrderById(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "Invalid Sales Order ID",
      });
    }

    const salesOrder = await prisma.salesOrder.findUnique({
      where: {
        id,
      },

      include: {
        customer: true,

        quotation: {
          include: {
            enquiry: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        },

        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },

        items: {
          include: {
            product: true,
          },
        },

        dispatch: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!salesOrder) {
      return res.status(404).json({
        message: "Sales Order not found",
      });
    }

    return res.status(200).json({
      salesOrder,
    });
  } catch (error) {
    console.error("Get sales order error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

// ======================================================
// CONFIRM SALES ORDER + RESERVE INVENTORY
// ADMIN ONLY
// ======================================================

export async function confirmSalesOrder(
  req: Request,
  res: Response
) {
  try {
    const salesOrderId = Number(req.params.id);

    if (!Number.isInteger(salesOrderId)) {
      return res.status(400).json({
        message: "Invalid Sales Order ID",
      });
    }

    const salesOrder = await prisma.salesOrder.findUnique({
      where: {
        id: salesOrderId,
      },

      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
    });

    if (!salesOrder) {
      return res.status(404).json({
        message: "Sales Order not found",
      });
    }

    if (salesOrder.status === "CONFIRMED") {
      return res.status(400).json({
        message: "Sales Order is already confirmed",
      });
    }

    if (salesOrder.status === "DISPATCHED") {
      return res.status(400).json({
        message: "Sales Order is already dispatched",
      });
    }

    if (salesOrder.status === "CANCELLED") {
      return res.status(400).json({
        message: "A cancelled Sales Order cannot be confirmed",
      });
    }

    if (salesOrder.status !== "PENDING") {
      return res.status(400).json({
        message:
          "Only a PENDING Sales Order can be confirmed",
      });
    }

    if (salesOrder.items.length === 0) {
      return res.status(400).json({
        message:
          "Sales Order must contain at least one item",
      });
    }

    const confirmedOrder = await prisma.$transaction(
      async (tx) => {
        /*
         * STEP 1
         * Change PENDING → CONFIRMED conditionally.
         *
         * This prevents two admins/processes from
         * confirming the same Sales Order simultaneously.
         */
        const statusUpdate =
          await tx.salesOrder.updateMany({
            where: {
              id: salesOrderId,
              status: "PENDING",
            },
            data: {
              status: "CONFIRMED",
            },
          });

        if (statusUpdate.count !== 1) {
          throw new Error(
            "Sales Order was already confirmed or is no longer PENDING"
          );
        }

        /*
         * STEP 2
         * Sort products by ID.
         *
         * This gives concurrent transactions a consistent
         * locking order and reduces deadlock risk.
         */
        const items = [...salesOrder.items].sort(
          (a, b) => a.productId - b.productId
        );

        /*
         * STEP 3
         * Atomically reserve inventory.
         *
         * available quantity:
         *
         * physicalQuantity - reservedQuantity
         *
         * The UPDATE succeeds ONLY when enough stock
         * is available.
         */
        for (const item of items) {
          const updatedRows =
            await tx.$executeRaw`
              UPDATE "Inventory"
              SET "reservedQuantity" =
                    "reservedQuantity" + ${item.quantity}
              WHERE "productId" = ${item.productId}
                AND (
                  "physicalQuantity" - "reservedQuantity"
                ) >= ${item.quantity}
            `;

          if (updatedRows !== 1) {
            throw new Error(
              `Insufficient inventory for product ${item.product.code}`
            );
          }
        }

        /*
         * STEP 4
         * Return the confirmed order.
         */
        return await tx.salesOrder.findUnique({
          where: {
            id: salesOrderId,
          },

          include: {
            customer: true,

            quotation: {
              include: {
                enquiry: true,
              },
            },

            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },

            items: {
              include: {
                product: true,
              },
            },
          },
        });
      }
    );

    return res.status(200).json({
      message:
        "Sales Order confirmed and inventory reserved successfully",
      salesOrder: confirmedOrder,
    });
  } catch (error: any) {
    console.error(
      "Confirm sales order error:",
      error
    );

    /*
     * IMPORTANT:
     *
     * If inventory reservation fails,
     * the entire transaction rolls back.
     *
     * Therefore:
     *
     * Sales Order remains PENDING
     * AND
     * reservedQuantity remains unchanged.
     */
    if (
      error?.message?.includes(
        "Insufficient inventory"
      )
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    if (
      error?.message?.includes(
        "already confirmed"
      )
    ) {
      return res.status(409).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

// ======================================================
// CANCEL SALES ORDER
// ======================================================

export async function cancelSalesOrder(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "Invalid Sales Order ID",
      });
    }

    const salesOrder =
      await prisma.salesOrder.findUnique({
        where: {
          id,
        },
      });

    if (!salesOrder) {
      return res.status(404).json({
        message: "Sales Order not found",
      });
    }

    if (salesOrder.status === "DISPATCHED") {
      return res.status(400).json({
        message:
          "A dispatched Sales Order cannot be cancelled",
      });
    }

    if (salesOrder.status === "CANCELLED") {
      return res.status(400).json({
        message:
          "Sales Order is already cancelled",
      });
    }

    /*
     * Confirmed-order cancellation needs reservation
     * release logic. We will implement that together
     * with the complete inventory lifecycle.
     */
    if (salesOrder.status === "CONFIRMED") {
      return res.status(400).json({
        message:
          "A confirmed Sales Order cannot be cancelled at this stage",
      });
    }

    const updatedOrder =
      await prisma.salesOrder.update({
        where: {
          id,
        },

        data: {
          status: "CANCELLED",
        },

        include: {
          customer: true,

          items: {
            include: {
              product: true,
            },
          },
        },
      });

    return res.status(200).json({
      message:
        "Sales Order cancelled successfully",
      salesOrder: updatedOrder,
    });
  } catch (error) {
    console.error(
      "Cancel sales order error:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}