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

  // --- Fake Tenants (15 tenants) ---
  const tenants = [
    { firstName: "Nguyen", lastName: "Van An", phone: "0901234567", email: "nguyenvanan@email.com", idType: "CCCD", idNumber: "001099012345" },
    { firstName: "Tran", lastName: "Thi Bich", phone: "0912345678", email: "tranbich@email.com", idType: "CCCD", idNumber: "001099012346" },
    { firstName: "Le", lastName: "Hoang Nam", phone: "0933456789", email: "lenam@email.com", idType: "CCCD", idNumber: "001099012347" },
    { firstName: "Pham", lastName: "Thi Lan", phone: "0974567890", email: "phamlan@email.com", idType: "CMND", idNumber: "271234567" },
    { firstName: "Hoang", lastName: "Duc Minh", phone: "0985678901", email: "hoangminh@email.com", idType: "CCCD", idNumber: "001099012348" },
    { firstName: "Vo", lastName: "Thi Hoa", phone: "0326789012", email: "vohoa@email.com", idType: "CCCD", idNumber: "001099012349" },
    { firstName: "Dang", lastName: "Quang Huy", phone: "0337890123", email: "danghuy@email.com", idType: "CCCD", idNumber: "001099012350" },
    { firstName: "Bui", lastName: "Thi Mai", phone: "0358901234", email: "buimai@email.com", idType: "Passport", idNumber: "C1234567" },
    { firstName: "Do", lastName: "Thanh Tung", phone: "0369012345", email: "dotung@email.com", idType: "CCCD", idNumber: "001099012351" },
    { firstName: "Ngo", lastName: "Thi Nga", phone: "0380123456", email: "ngonga@email.com", idType: "CMND", idNumber: "271234568" },
    { firstName: "Duong", lastName: "Van Son", phone: "0921234567", email: "duongson@email.com", idType: "CCCD", idNumber: "001099012352" },
    { firstName: "Ly", lastName: "Thi Trang", phone: "0932345678", email: "lytrang@email.com", idType: "CCCD", idNumber: "001099012353" },
    { firstName: "Trinh", lastName: "Minh Quan", phone: "0943456789", email: "trinhquan@email.com", idType: "CCCD", idNumber: "001099012354" },
    { firstName: "Mai", lastName: "Thi Huong", phone: "0954567890", email: "maihuong@email.com", idType: "CCCD", idNumber: "001099012355" },
    { firstName: "Cao", lastName: "Van Long", phone: "0965678901", email: "caolong@email.com", idType: "Passport", idNumber: "C7654321" },
  ];

  const createdTenants = [];
  for (const t of tenants) {
    const tenant = await prisma.tenant.create({ data: t });
    createdTenants.push(tenant);
  }

  // --- Active Contracts for rooms 1-7 (with occupants) ---
  const now = new Date();

  // Room 1: Nguyen Van An + wife + child
  const c1 = await prisma.contract.create({
    data: {
      roomId: 1, tenantId: createdTenants[0].id,
      startDate: new Date(now.getFullYear(), now.getMonth() - 3, 15),
      monthlyRent: 3000000, deposit: 3000000, status: "active",
      occupants: {
        create: [
          { firstName: "Nguyen", lastName: "Thi Huyen", phone: "0901111111", relationship: "spouse", idType: "CCCD", idNumber: "001099099001" },
          { firstName: "Nguyen", lastName: "Bao Khang", phone: "", relationship: "family", idType: "", idNumber: "" },
        ],
      },
    },
  });
  await prisma.room.update({ where: { id: 1 }, data: { status: "occupied" } });

  // Room 2: Tran Thi Bich (single)
  await prisma.contract.create({
    data: {
      roomId: 2, tenantId: createdTenants[1].id,
      startDate: new Date(now.getFullYear(), now.getMonth() - 5, 1),
      monthlyRent: 2800000, deposit: 2800000, status: "active",
    },
  });
  await prisma.room.update({ where: { id: 2 }, data: { status: "occupied" } });

  // Room 3: Le Hoang Nam + roommate
  await prisma.contract.create({
    data: {
      roomId: 3, tenantId: createdTenants[2].id,
      startDate: new Date(now.getFullYear(), now.getMonth() - 1, 10),
      monthlyRent: 3200000, deposit: 3200000, status: "active",
      occupants: {
        create: [
          { firstName: "Truong", lastName: "Van Dat", phone: "0339876543", relationship: "roommate", idType: "CCCD", idNumber: "001099099002" },
        ],
      },
    },
  });
  await prisma.room.update({ where: { id: 3 }, data: { status: "occupied" } });

  // Room 4: Pham Thi Lan + husband + 2 kids
  await prisma.contract.create({
    data: {
      roomId: 4, tenantId: createdTenants[3].id,
      startDate: new Date(now.getFullYear(), now.getMonth() - 8, 1),
      monthlyRent: 3500000, deposit: 7000000, status: "active",
      occupants: {
        create: [
          { firstName: "Tran", lastName: "Van Phong", phone: "0977654321", relationship: "spouse", idType: "CMND", idNumber: "271999888" },
          { firstName: "Tran", lastName: "Bao Ngoc", phone: "", relationship: "family", idType: "", idNumber: "" },
          { firstName: "Tran", lastName: "Minh Khoi", phone: "", relationship: "family", idType: "", idNumber: "" },
        ],
      },
    },
  });
  await prisma.room.update({ where: { id: 4 }, data: { status: "occupied" } });

  // Room 5: Hoang Duc Minh + girlfriend
  await prisma.contract.create({
    data: {
      roomId: 5, tenantId: createdTenants[4].id,
      startDate: new Date(now.getFullYear(), now.getMonth() - 2, 20),
      monthlyRent: 3000000, deposit: 3000000, status: "active",
      occupants: {
        create: [
          { firstName: "Vu", lastName: "Thi Thuy", phone: "0368765432", relationship: "friend", idType: "CCCD", idNumber: "001099099003" },
        ],
      },
    },
  });
  await prisma.room.update({ where: { id: 5 }, data: { status: "occupied" } });

  // Room 6: Vo Thi Hoa (single)
  await prisma.contract.create({
    data: {
      roomId: 6, tenantId: createdTenants[5].id,
      startDate: new Date(now.getFullYear(), now.getMonth() - 4, 5),
      monthlyRent: 2500000, deposit: 2500000, status: "active",
    },
  });
  await prisma.room.update({ where: { id: 6 }, data: { status: "occupied" } });

  // Room 7: Dang Quang Huy + 2 roommates
  await prisma.contract.create({
    data: {
      roomId: 7, tenantId: createdTenants[6].id,
      startDate: new Date(now.getFullYear(), now.getMonth() - 6, 1),
      monthlyRent: 3800000, deposit: 3800000, status: "active",
      occupants: {
        create: [
          { firstName: "Lam", lastName: "Van Tai", phone: "0355555555", relationship: "roommate", idType: "CCCD", idNumber: "001099099004" },
          { firstName: "Phan", lastName: "Duc Tho", phone: "0366666666", relationship: "roommate", idType: "CCCD", idNumber: "001099099005" },
        ],
      },
    },
  });
  await prisma.room.update({ where: { id: 7 }, data: { status: "occupied" } });

  // Room 8: maintenance
  await prisma.room.update({ where: { id: 8 }, data: { status: "maintenance", notes: "Fixing bathroom pipes" } });

  // --- Ended contract (past tenant in room 9) ---
  await prisma.contract.create({
    data: {
      roomId: 9, tenantId: createdTenants[7].id,
      startDate: new Date(now.getFullYear(), now.getMonth() - 10, 1),
      endDate: new Date(now.getFullYear(), now.getMonth() - 2, 28),
      monthlyRent: 2800000, deposit: 2800000, status: "ended",
    },
  });

  // --- Payments for active contracts (last 2 months) ---
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const activeContracts = await prisma.contract.findMany({ where: { status: "active" } });
  for (const contract of activeContracts) {
    // Previous month — all paid
    await prisma.payment.create({
      data: {
        contractId: contract.id, amount: contract.monthlyRent,
        month: prevMonth, type: "rent", method: "cash", status: "paid",
        paidAt: new Date(now.getFullYear(), now.getMonth() - 1, 5),
      },
    });
    // Current month — some paid, some pending
    await prisma.payment.create({
      data: {
        contractId: contract.id, amount: contract.monthlyRent,
        month: currentMonth, type: "rent",
        method: contract.id % 2 === 0 ? "transfer" : "cash",
        status: contract.id <= 4 ? "paid" : "pending",
        paidAt: contract.id <= 4 ? new Date(now.getFullYear(), now.getMonth(), 3) : null,
      },
    });
  }

  console.log("Seed completed: admin user, 10 rooms, 15 tenants, 8 contracts (7 active + 1 ended), occupants, and payments created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
