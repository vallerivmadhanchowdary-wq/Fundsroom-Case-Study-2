import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("🌱 Starting database seed...");

  // =========================
  // 1. CREATE USERS
  // =========================

  const adminPassword = await bcrypt.hash("Admin@123", 10);
  const salesPassword = await bcrypt.hash("Sales@123", 10);

  const admin = await prisma.user.upsert({
    where: {
      email: "admin@fundsroom.com",
    },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@fundsroom.com",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });

  const sales = await prisma.user.upsert({
    where: {
      email: "sales@fundsroom.com",
    },
    update: {},
    create: {
      name: "Sales User",
      email: "sales@fundsroom.com",
      passwordHash: salesPassword,
      role: "SALES",
    },
  });

  console.log("✅ Admin created:", admin.email);
  console.log("✅ Sales user created:", sales.email);

  // =========================
  // 2. CREATE PRODUCTS
  // =========================

  const products = [
    {
      code: "HP-001",
      name: "Hydraulic Pump",
      category: "Hydraulics",
      unit: "Piece",
      basePrice: 18500,
      physicalQuantity: 100,
    },
    {
      code: "IM-002",
      name: "Industrial Motor",
      category: "Motors",
      unit: "Piece",
      basePrice: 32500,
      physicalQuantity: 75,
    },
    {
      code: "PV-003",
      name: "Pressure Control Valve",
      category: "Valves",
      unit: "Piece",
      basePrice: 8750,
      physicalQuantity: 120,
    },
    {
      code: "SB-004",
      name: "Steel Bearing",
      category: "Bearings",
      unit: "Piece",
      basePrice: 2450,
      physicalQuantity: 250,
    },
    {
      code: "CB-005",
      name: "Conveyor Belt",
      category: "Material Handling",
      unit: "Meter",
      basePrice: 1450,
      physicalQuantity: 500,
    },
    {
      code: "CP-006",
      name: "Industrial Control Panel",
      category: "Electrical",
      unit: "Piece",
      basePrice: 42000,
      physicalQuantity: 40,
    },
  ];

  for (const item of products) {
    const product = await prisma.product.upsert({
      where: {
        code: item.code,
      },
      update: {
        name: item.name,
        category: item.category,
        unit: item.unit,
        basePrice: item.basePrice,
      },
      create: {
        code: item.code,
        name: item.name,
        category: item.category,
        unit: item.unit,
        basePrice: item.basePrice,
      },
    });

    await prisma.inventory.upsert({
      where: {
        productId: product.id,
      },
      update: {},
      create: {
        productId: product.id,
        physicalQuantity: item.physicalQuantity,
        reservedQuantity: 0,
      },
    });

    console.log(
      `✅ Product added: ${product.code} - ${product.name}`
    );
  }

  console.log("🎉 Database seed completed successfully!");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });