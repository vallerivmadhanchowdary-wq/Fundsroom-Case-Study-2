import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

function generateEnquiryNumber(): string {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const random = Math.floor(1000 + Math.random() * 9000);

  return `ENQ-${year}${month}${day}-${random}`;
}

export async function createEnquiry(req: Request, res: Response) {
  try {
    const {
      customerId,
      enquiryDate,
      requiredDate,
      items,
      notes,
    } = req.body;

    // Basic validation
    if (!customerId) {
      return res.status(400).json({
        message: "Customer ID is required",
      });
    }

    if (!enquiryDate) {
      return res.status(400).json({
        message: "Enquiry date is required",
      });
    }

    if (!requiredDate) {
      return res.status(400).json({
        message: "Required date is required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "At least one product is required",
      });
    }

    const parsedCustomerId = Number(customerId);

    if (!Number.isInteger(parsedCustomerId)) {
      return res.status(400).json({
        message: "Invalid customer ID",
      });
    }

    const parsedEnquiryDate = new Date(enquiryDate);
    const parsedRequiredDate = new Date(requiredDate);

    if (Number.isNaN(parsedEnquiryDate.getTime())) {
      return res.status(400).json({
        message: "Invalid enquiry date",
      });
    }

    if (Number.isNaN(parsedRequiredDate.getTime())) {
      return res.status(400).json({
        message: "Invalid required date",
      });
    }

    if (parsedRequiredDate < parsedEnquiryDate) {
      return res.status(400).json({
        message: "Required date cannot be before enquiry date",
      });
    }

    // Validate customer
    const customer = await prisma.customer.findUnique({
      where: {
        id: parsedCustomerId,
      },
    });

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    // Validate enquiry items
    const productIds: number[] = [];

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
            "Product quantity must be a positive whole number",
        });
      }

      productIds.push(productId);
    }

    // Prevent duplicate products in the same enquiry
    const uniqueProductIds = new Set(productIds);

    if (uniqueProductIds.size !== productIds.length) {
      return res.status(400).json({
        message:
          "The same product cannot be added multiple times to one enquiry",
      });
    }

    // Check that all products exist
    const products = await prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({
        message: "One or more products do not exist",
      });
    }

    // Create enquiry + enquiry items in one transaction
    const enquiry = await prisma.$transaction(async (tx) => {
      let enquiryNumber = generateEnquiryNumber();

      // Very unlikely collision protection
      while (
        await tx.enquiry.findUnique({
          where: {
            enquiryNumber,
          },
        })
      ) {
        enquiryNumber = generateEnquiryNumber();
      }

      const createdEnquiry = await tx.enquiry.create({
        data: {
          enquiryNumber,
          customerId: parsedCustomerId,
          enquiryDate: parsedEnquiryDate,
          requiredDate: parsedRequiredDate,
          notes: notes ? String(notes).trim() : null,
          createdById: req.user!.userId,
          status: "NEW",
        },
      });

      await tx.enquiryItem.createMany({
        data: items.map((item: any) => ({
          enquiryId: createdEnquiry.id,
          productId: Number(item.productId),
          quantity: Number(item.quantity),
        })),
      });

      return createdEnquiry;
    });

    // Fetch complete enquiry
    const completeEnquiry = await prisma.enquiry.findUnique({
      where: {
        id: enquiry.id,
      },
      include: {
        customer: true,
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
      message: "Enquiry created successfully",
      enquiry: completeEnquiry,
    });
  } catch (error) {
    console.error("Create enquiry error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function getEnquiries(
  req: Request,
  res: Response
) {
  try {
    const enquiries = await prisma.enquiry.findMany({
      include: {
        customer: true,
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
        quotation: {
          select: {
            id: true,
            quotationNumber: true,
            status: true,
            totalAmount: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      enquiries,
    });
  } catch (error) {
    console.error("Get enquiries error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function getEnquiryById(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "Invalid enquiry ID",
      });
    }

    const enquiry = await prisma.enquiry.findUnique({
      where: {
        id,
      },
      include: {
        customer: true,
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
        quotation: {
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

    if (!enquiry) {
      return res.status(404).json({
        message: "Enquiry not found",
      });
    }

    return res.status(200).json({
      enquiry,
    });
  } catch (error) {
    console.error("Get enquiry error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function updateEnquiryStatus(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "Invalid enquiry ID",
      });
    }

    const allowedStatuses = [
      "NEW",
      "QUOTED",
      "WON",
      "LOST",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid enquiry status",
      });
    }

    const enquiry = await prisma.enquiry.findUnique({
      where: {
        id,
      },
    });

    if (!enquiry) {
      return res.status(404).json({
        message: "Enquiry not found",
      });
    }

    // Prevent invalid backward status changes
    if (enquiry.status === "LOST") {
      return res.status(400).json({
        message: "A LOST enquiry cannot be changed",
      });
    }

    if (enquiry.status === "WON") {
      return res.status(400).json({
        message: "A WON enquiry cannot be changed",
      });
    }

    if (
      enquiry.status === "NEW" &&
      status === "WON"
    ) {
      return res.status(400).json({
        message:
          "A NEW enquiry must become QUOTED before WON",
      });
    }

    if (
      enquiry.status === "QUOTED" &&
      status === "NEW"
    ) {
      return res.status(400).json({
        message:
          "A QUOTED enquiry cannot return to NEW",
      });
    }

    if (
      enquiry.status === "QUOTED" &&
      status === "QUOTED"
    ) {
      return res.status(400).json({
        message: "Enquiry is already QUOTED",
      });
    }

    const updatedEnquiry =
      await prisma.enquiry.update({
        where: {
          id,
        },
        data: {
          status,
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
      message: "Enquiry status updated successfully",
      enquiry: updatedEnquiry,
    });
  } catch (error) {
    console.error(
      "Update enquiry status error:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}