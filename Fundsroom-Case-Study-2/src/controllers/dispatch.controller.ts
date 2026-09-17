import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

function generateDispatchNumber(): string {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const random = Math.floor(1000 + Math.random() * 9000);

  return `DSP-${year}${month}${day}-${random}`;
}

// ======================================================
// CREATE DISPATCH
// ADMIN ONLY
// ======================================================

export async function createDispatch(
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

    const {
      dispatchNumber,
      dispatchDate,
      vehicleNumber,
      driverName,
      items,
    } = req.body;

    // --------------------------------------------------
    // BASIC VALIDATION
    // --------------------------------------------------

    if (!vehicleNumber || !String(vehicleNumber).trim()) {
      return res.status(400).json({
        message: "Vehicle number is required",
      });
    }

    if (!driverName || !String(driverName).trim()) {
      return res.status(400).json({
        message: "Driver name is required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message:
          "At least one dispatch item is required",
      });
    }

    // --------------------------------------------------
    // DISPATCH DATE VALIDATION
    // --------------------------------------------------

    let parsedDispatchDate = new Date();

    if (dispatchDate) {
      parsedDispatchDate = new Date(dispatchDate);

      if (Number.isNaN(parsedDispatchDate.getTime())) {
        return res.status(400).json({
          message: "Invalid dispatch date",
        });
      }
    }

    // --------------------------------------------------
    // GET SALES ORDER
    // --------------------------------------------------

    const salesOrder =
      await prisma.salesOrder.findUnique({
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

          items: {
            include: {
              product: true,
            },
          },

          dispatch: true,
        },
      });

    if (!salesOrder) {
      return res.status(404).json({
        message: "Sales Order not found",
      });
    }

    // --------------------------------------------------
    // ONLY CONFIRMED ORDER CAN BE DISPATCHED
    // --------------------------------------------------

    if (salesOrder.status !== "CONFIRMED") {
      return res.status(400).json({
        message:
          "Only a CONFIRMED Sales Order can be dispatched",
      });
    }

    // --------------------------------------------------
    // PREVENT DUPLICATE DISPATCH
    // --------------------------------------------------

    if (salesOrder.dispatch) {
      return res.status(409).json({
        message:
          "This Sales Order has already been dispatched",
        dispatch: salesOrder.dispatch,
      });
    }

    // --------------------------------------------------
    // VALIDATE DISPATCH ITEMS
    // --------------------------------------------------

    const salesOrderItemMap = new Map(
      salesOrder.items.map((item) => [
        item.productId,
        item,
      ])
    );

    const dispatchProductIds: number[] = [];

    for (const item of items) {
      const productId = Number(item.productId);
      const quantity = Number(item.quantity);

      if (!Number.isInteger(productId)) {
        return res.status(400).json({
          message: "Invalid product ID",
        });
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({
          message:
            "Dispatch quantity must be a positive whole number",
        });
      }

      const salesOrderItem =
        salesOrderItemMap.get(productId);

      if (!salesOrderItem) {
        return res.status(400).json({
          message:
            `Product ${productId} is not part of this Sales Order`,
        });
      }

      // Since this schema supports one dispatch per order,
      // require the complete Sales Order quantity.
      if (quantity !== salesOrderItem.quantity) {
        return res.status(400).json({
          message:
            `Dispatch quantity for ${salesOrderItem.product.code} must be exactly ${salesOrderItem.quantity}`,
        });
      }

      dispatchProductIds.push(productId);
    }

    // --------------------------------------------------
    // PREVENT DUPLICATE PRODUCTS IN DISPATCH
    // --------------------------------------------------

    const uniqueProductIds =
      new Set(dispatchProductIds);

    if (
      uniqueProductIds.size !==
      dispatchProductIds.length
    ) {
      return res.status(400).json({
        message:
          "The same product cannot be added multiple times to one dispatch",
      });
    }

    // --------------------------------------------------
    // REQUIRE ALL SALES ORDER ITEMS
    // --------------------------------------------------

    if (
      uniqueProductIds.size !==
      salesOrder.items.length
    ) {
      return res.status(400).json({
        message:
          "All Sales Order items must be included in the dispatch",
      });
    }

    // --------------------------------------------------
    // SORT ITEMS BY PRODUCT ID
    // Consistent order reduces concurrent lock issues.
    // --------------------------------------------------

    const sortedItems = [...items].sort(
      (a, b) =>
        Number(a.productId) -
        Number(b.productId)
    );

    // --------------------------------------------------
    // TRANSACTION
    // --------------------------------------------------

    const dispatch =
      await prisma.$transaction(async (tx) => {
        /*
         * STEP 1
         * Change CONFIRMED → DISPATCHED conditionally.
         *
         * If another request already dispatched the order,
         * this update will affect 0 rows.
         */
        const statusUpdate =
          await tx.salesOrder.updateMany({
            where: {
              id: salesOrderId,
              status: "CONFIRMED",
            },

            data: {
              status: "DISPATCHED",
            },
          });

        if (statusUpdate.count !== 1) {
          throw new Error(
            "Sales Order was already dispatched or is no longer CONFIRMED"
          );
        }

        /*
         * STEP 2
         * Generate dispatch number if user did not provide one.
         */
        let finalDispatchNumber =
          dispatchNumber
            ? String(dispatchNumber).trim()
            : generateDispatchNumber();

        /*
         * STEP 3
         * Prevent dispatch number collision.
         */
        while (
          await tx.dispatch.findUnique({
            where: {
              dispatchNumber:
                finalDispatchNumber,
            },
          })
        ) {
          finalDispatchNumber =
            generateDispatchNumber();
        }

        /*
         * STEP 4
         * Atomically reduce physical stock AND reserved stock.
         *
         * Example:
         *
         * Physical = 100
         * Reserved = 20
         * Dispatch = 20
         *
         * Result:
         *
         * Physical = 80
         * Reserved = 0
         */
        for (const item of sortedItems) {
          const productId =
            Number(item.productId);

          const quantity =
            Number(item.quantity);

          const updatedRows =
            await tx.$executeRaw`
              UPDATE "Inventory"
              SET
                "physicalQuantity" =
                  "physicalQuantity" - ${quantity},
                "reservedQuantity" =
                  "reservedQuantity" - ${quantity}
              WHERE "productId" = ${productId}
                AND "reservedQuantity" >= ${quantity}
                AND "physicalQuantity" >= ${quantity}
            `;

          if (updatedRows !== 1) {
            throw new Error(
              `Insufficient reserved inventory for product ${productId}`
            );
          }
        }

        /*
         * STEP 5
         * Create Dispatch record.
         */
        const createdDispatch =
          await tx.dispatch.create({
            data: {
              dispatchNumber:
                finalDispatchNumber,

              salesOrderId,

              dispatchDate:
                parsedDispatchDate,

              vehicleNumber:
                String(vehicleNumber).trim(),

              driverName:
                String(driverName).trim(),
            },
          });

        /*
         * STEP 6
         * Create Dispatch Items.
         */
        await tx.dispatchItem.createMany({
          data: sortedItems.map((item: any) => ({
            dispatchId:
              createdDispatch.id,

            productId:
              Number(item.productId),

            quantity:
              Number(item.quantity),
          })),
        });

        return createdDispatch;
      });

    // --------------------------------------------------
    // GET COMPLETE DISPATCH
    // --------------------------------------------------

    const completeDispatch =
      await prisma.dispatch.findUnique({
        where: {
          id: dispatch.id,
        },

        include: {
          salesOrder: {
            include: {
              customer: true,

              quotation: {
                include: {
                  enquiry: true,
                },
              },

              items: {
                include: {
                  product: true,
                },
              },
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
      message:
        "Dispatch created successfully and inventory updated",
      dispatch: completeDispatch,
    });
  } catch (error: any) {
    console.error(
      "Create dispatch error:",
      error
    );

    if (
      error?.message?.includes(
        "Insufficient reserved inventory"
      )
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    if (
      error?.message?.includes(
        "already dispatched"
      )
    ) {
      return res.status(409).json({
        message: error.message,
      });
    }

    if (error?.code === "P2002") {
      return res.status(409).json({
        message:
          "Dispatch already exists for this Sales Order or dispatch number already exists",
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

// ======================================================
// GET ALL DISPATCHES
// ADMIN ONLY
// ======================================================

export async function getDispatches(
  _req: Request,
  res: Response
) {
  try {
    const dispatches =
      await prisma.dispatch.findMany({
        include: {
          salesOrder: {
            include: {
              customer: true,
            },
          },

          items: {
            include: {
              product: true,
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return res.status(200).json({
      dispatches,
    });
  } catch (error) {
    console.error(
      "Get dispatches error:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

// ======================================================
// GET DISPATCH BY ID
// ======================================================

export async function getDispatchById(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "Invalid dispatch ID",
      });
    }

    const dispatch =
      await prisma.dispatch.findUnique({
        where: {
          id,
        },

        include: {
          salesOrder: {
            include: {
              customer: true,

              quotation: {
                include: {
                  enquiry: true,
                },
              },

              items: {
                include: {
                  product: true,
                },
              },
            },
          },

          items: {
            include: {
              product: true,
            },
          },
        },
      });

    if (!dispatch) {
      return res.status(404).json({
        message: "Dispatch not found",
      });
    }

    return res.status(200).json({
      dispatch,
    });
  } catch (error) {
    console.error(
      "Get dispatch error:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}