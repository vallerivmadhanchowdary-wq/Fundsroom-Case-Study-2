import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export async function createCustomer(req: Request, res: Response) {
  try {
    const {
      companyName,
      contactPerson,
      mobile,
      email,
      city,
    } = req.body;

    if (!companyName || !contactPerson || !mobile || !city) {
      return res.status(400).json({
        message:
          "Company name, contact person, mobile and city are required",
      });
    }

    const customer = await prisma.customer.create({
      data: {
        companyName: String(companyName).trim(),
        contactPerson: String(contactPerson).trim(),
        mobile: String(mobile).trim(),
        email: email ? String(email).trim().toLowerCase() : null,
        city: String(city).trim(),
      },
    });

    return res.status(201).json({
      message: "Customer created successfully",
      customer,
    });
  } catch (error) {
    console.error("Create customer error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function getCustomers(
  _req: Request,
  res: Response
) {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      customers,
    });
  } catch (error) {
    console.error("Get customers error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function getCustomerById(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "Invalid customer ID",
      });
    }

    const customer = await prisma.customer.findUnique({
      where: {
        id,
      },
    });

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      customer,
    });
  } catch (error) {
    console.error("Get customer error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function updateCustomer(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "Invalid customer ID",
      });
    }

    const existingCustomer = await prisma.customer.findUnique({
      where: {
        id,
      },
    });

    if (!existingCustomer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const {
      companyName,
      contactPerson,
      mobile,
      email,
      city,
    } = req.body;

    const customer = await prisma.customer.update({
      where: {
        id,
      },
      data: {
        ...(companyName !== undefined && {
          companyName: String(companyName).trim(),
        }),
        ...(contactPerson !== undefined && {
          contactPerson: String(contactPerson).trim(),
        }),
        ...(mobile !== undefined && {
          mobile: String(mobile).trim(),
        }),
        ...(email !== undefined && {
          email: email ? String(email).trim().toLowerCase() : null,
        }),
        ...(city !== undefined && {
          city: String(city).trim(),
        }),
      },
    });

    return res.status(200).json({
      message: "Customer updated successfully",
      customer,
    });
  } catch (error) {
    console.error("Update customer error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function deleteCustomer(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "Invalid customer ID",
      });
    }

    const existingCustomer = await prisma.customer.findUnique({
      where: {
        id,
      },
    });

    if (!existingCustomer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const customer = await prisma.customer.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      message: "Customer deleted successfully",
      customer,
    });
  } catch (error) {
    console.error("Delete customer error:", error);

    return res.status(500).json({
      message:
        "Customer cannot be deleted because it may be linked to existing records",
    });
  }
}