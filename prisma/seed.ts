import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create default admin user
  const hashedPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: hashedPassword,
    },
  });

  // Create 10 rooms
  for (let i = 1; i <= 10; i++) {
    await prisma.room.upsert({
      where: { number: i },
      update: {},
      create: {
        number: i,
        name: `Room ${i}`,
        floor: i <= 5 ? 1 : 2,
        rate: 3000000, // default monthly rate
        status: "vacant",
      },
    });
  }

  // Default settings
  const defaults = [
    { key: "motel_name", value: "My Motel" },
    { key: "motel_address", value: "" },
    { key: "motel_phone", value: "" },
    { key: "default_room_rate", value: "3000000" },
    { key: "electric_rate", value: "3500" },
    { key: "water_rate", value: "20000" },
    { key: "currency", value: "VND" },
  ];

  for (const setting of defaults) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log("Seed completed: admin user, 10 rooms, and default settings created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
