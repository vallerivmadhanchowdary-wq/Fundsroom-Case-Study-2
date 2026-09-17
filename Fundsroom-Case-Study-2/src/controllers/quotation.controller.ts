import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

function generateQuotationNumber(): string {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const random = Math.floor(1000 + Math.random() * 9000);

  return `QUO-${year}${month}${day}-${random}`;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateLineAmount(
  quantity: number,
  unitPrice: number,
  discountPercent: number,
  gstPercent: number
): number {
  const baseAmount = quantity * unitPrice;

  const discountAmount =
    baseAmount * (discountPercent / 100);

  const discountedAmount =
    baseAmount - discountAmount;

  const gstAmount =
    discountedAmount * (gstPercent / 100);

  return roundMoney(
    discountedAmount + gstAmount
  );
}

export async function createQuotation(
  req: Request,
  res: Response
) {
  try {
    const {
      enquiryId,
      validUntil,
      items,
    } = req.body;

    if (!enquiryId) {
      return res.status(400).json({
        message: "Enquiry ID is required",
      });
    }

    if (!validUntil) {
      return res.status(400).json({
        message: "Valid until date is required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message:
          "At least one quotation item is required",
      });
    }

    const parsedEnquiryId = Number(enquiryId);

    if (!Number.isInteger(parsedEnquiryId)) {
      return res.status(400).json({
        message: "Invalid enquiry ID",
      });
    }

    const parsedValidUntil = new Date(validUntil);

    if (Number.isNaN(parsedValidUntil.getTime())) {
      return res.status(400).json({
        message: "Invalid valid until date",
      });
    }

    // Find enquiry
    const enquiry = await prisma.enquiry.findUnique({
      where: {
        id: parsedEnquiryId,
      },
      include: {
        customer: true,
        items: true,
        quotation: true,
      },
    });

    if (!enquiry) {
      return res.status(404).json({
        message: "Enquiry not found",
      });
    }

    // One enquiry can have only one quotation
    if (enquiry.quotation) {
      return res.status(409).json({
        message:
          "A quotation already exists for this enquiry",
      });
    }

    // Only active enquiries should get quotations
    if (
      enquiry.status === "LOST"
    ) {
      return res.status(400).json({
        message:
          "A LOST enquiry cannot have a quotation",
      });
    }

    if (
      enquiry.status === "WON"
    ) {
      return res.status(400).json({
        message:
          "A WON enquiry cannot have another quotation",
      });
    }

    const productIds: number[] = [];

    // Validate quotation items
    for (const item of items) {
      const productId = Number(item.productId);
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);

      const discountPercent =
        item.discountPercent === undefined
          ? 0
          : Number(item.discountPercent);

      const gstPercent =
        item.gstPercent === undefined
          ? 18
          : Number(item.gstPercent);

      if (!Number.isInteger(productId)) {
        return res.status(400).json({
          message: "Invalid product ID",
        });
      }

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        return res.status(400).json({
          message:
            "Quantity must be a positive whole number",
        });
      }

      if (
        !Number.isFinite(unitPrice) ||
        unitPrice < 0
      ) {
        return res.status(400).json({
          message:
            "Unit price must be a valid non-negative number",
        });
      }

      if (
        !Number.isFinite(discountPercent) ||
        discountPercent < 0 ||
        discountPercent > 100
      ) {
        return res.status(400).json({
          message:
            "Discount must be between 0 and 100",
        });
      }

      if (
        !Number.isFinite(gstPercent) ||
        gstPercent < 0 ||
        gstPercent > 100
      ) {
        return res.status(400).json({
          message:
            "GST must be between 0 and 100",
        });
      }

      productIds.push(productId);
    }

    // Prevent duplicate products
    const uniqueProductIds = new Set(productIds);

    if (
      uniqueProductIds.size !== productIds.length
    ) {
      return res.status(400).json({
        message:
          "The same product cannot be added multiple times",
      });
    }

    // Check products exist
    const products = await prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({
        message:
          "One or more products do not exist",
      });
    }

    // Make sure quotation products belong to enquiry
    const enquiryProductIds =
      new Set(
        enquiry.items.map(
          (item) => item.productId
        )
      );

    for (const productId of productIds) {
      if (!enquiryProductIds.has(productId)) {
        return res.status(400).json({
          message:
            `Product ${productId} is not part of the enquiry`,
        });
      }
    }

    // Calculate everything on backend
    let grandTotal = 0;

    const quotationItems = items.map(
      (item: any) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);

        const discountPercent =
          item.discountPercent === undefined
            ? 0
            : Number(item.discountPercent);

        const gstPercent =
          item.gstPercent === undefined
            ? 18
            : Number(item.gstPercent);

        const lineAmount =
          calculateLineAmount(
            quantity,
            unitPrice,
            discountPercent,
            gstPercent
          );

        grandTotal += lineAmount;

        return {
          productId: Number(item.productId),
          quantity,
          unitPrice,
          discountPercent,
          gstPercent,
          lineAmount,
        };
      }
    );

    grandTotal = roundMoney(grandTotal);

    // Create quotation and items together
    const quotation =
      await prisma.$transaction(
        async (tx) => {
          let quotationNumber =
            generateQuotationNumber();

          while (
            await tx.quotation.findUnique({
              where: {
                quotationNumber,
              },
            })
          ) {
            quotationNumber =
              generateQuotationNumber();
          }

          const createdQuotation =
            await tx.quotation.create({
              data: {
                quotationNumber,
                enquiryId: enquiry.id,
                customerId: enquiry.customerId,
                validUntil: parsedValidUntil,
                status: "DRAFT",
                totalAmount: grandTotal,
                createdById: req.user!.userId,
              },
            });

          await tx.quotationItem.createMany({
            data: quotationItems.map(
              (item) => ({
                quotationId:
                  createdQuotation.id,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountPercent:
                  item.discountPercent,
                gstPercent:
                  item.gstPercent,
                lineAmount:
                  item.lineAmount,
              })
            ),
          });

          // Enquiry becomes QUOTED
          await tx.enquiry.update({
            where: {
              id: enquiry.id,
            },
            data: {
              status: "QUOTED",
            },
          });

          return createdQuotation;
        }
      );

    const completeQuotation =
      await prisma.quotation.findUnique({
        where: {
          id: quotation.id,
        },
        include: {
          customer: true,
          enquiry: true,
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
      message:
        "Quotation created successfully",
      quotation: completeQuotation,
    });
  } catch (error: any) {
    console.error(
      "Create quotation error:",
      error
    );

    if (error?.code === "P2002") {
      return res.status(409).json({
        message:
          "A quotation already exists for this enquiry or quotation number already exists",
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function getQuotations(
  _req: Request,
  res: Response
) {
  try {
    const quotations =
      await prisma.quotation.findMany({
        include: {
          customer: true,
          enquiry: true,
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
          salesOrder: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    return res.status(200).json({
      quotations,
    });
  } catch (error) {
    console.error(
      "Get quotations error:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function getQuotationById(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "Invalid quotation ID",
      });
    }

    const quotation =
      await prisma.quotation.findUnique({
        where: {
          id,
        },
        include: {
          customer: true,
          enquiry: {
            include: {
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
          salesOrder: true,
        },
      });

    if (!quotation) {
      return res.status(404).json({
        message: "Quotation not found",
      });
    }

    return res.status(200).json({
      quotation,
    });
  } catch (error) {
    console.error(
      "Get quotation error:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function updateQuotationStatus(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "Invalid quotation ID",
      });
    }

    const allowedStatuses = [
      "DRAFT",
      "SENT",
      "ACCEPTED",
      "REJECTED",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid quotation status",
      });
    }

    const quotation =
      await prisma.quotation.findUnique({
        where: {
          id,
        },
        include: {
          salesOrder: true,
        },
      });

    if (!quotation) {
      return res.status(404).json({
        message: "Quotation not found",
      });
    }

    if (quotation.salesOrder) {
      return res.status(400).json({
        message:
          "Quotation already has a Sales Order",
      });
    }

    // Prevent changing final states
    if (
      quotation.status === "ACCEPTED" ||
      quotation.status === "REJECTED"
    ) {
      return res.status(400).json({
        message:
          "An ACCEPTED or REJECTED quotation cannot be changed",
      });
    }

    // Valid flow:
    // DRAFT -> SENT
    // SENT -> ACCEPTED
    // SENT -> REJECTED

    if (
      quotation.status === "DRAFT" &&
      status !== "SENT"
    ) {
      return res.status(400).json({
        message:
          "DRAFT quotation can only be changed to SENT",
      });
    }

    if (
      quotation.status === "SENT" &&
      status !== "ACCEPTED" &&
      status !== "REJECTED"
    ) {
      return res.status(400).json({
        message:
          "SENT quotation can only be ACCEPTED or REJECTED",
      });
    }

    const updatedQuotation =
      await prisma.quotation.update({
        where: {
          id,
        },
        data: {
          status,
        },
        include: {
          customer: true,
          enquiry: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

    return res.status(200).json({
      message:
        "Quotation status updated successfully",
      quotation: updatedQuotation,
    });
  } catch (error) {
    console.error(
      "Update quotation status error:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}