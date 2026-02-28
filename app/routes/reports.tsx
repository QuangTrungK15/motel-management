import { useSearchParams } from "react-router";
import type { Route } from "./+types/reports";
import { prisma } from "~/lib/db.server";
import { requireAuth } from "~/lib/auth.server";
import { PageContainer } from "~/components/layout/page-container";
import { Header } from "~/components/layout/header";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import { Stat } from "~/components/ui/stat";
import { Badge } from "~/components/ui/badge";
import { Select } from "~/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { formatCurrency, formatMonth, formatDate } from "~/lib/utils";

export function meta() {
  return [{ title: "Reports - NhaTro" }];
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -11; i <= 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push({ value, label: formatMonth(value) });
  }
  return options.reverse();
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const month = url.searchParams.get("month") || getCurrentMonth();

  // --- Monthly Income ---
  const payments = await prisma.payment.findMany({
    where: { month },
    include: {
      contract: {
        include: { room: true, tenant: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rentIncome = payments
    .filter((p) => p.type === "rent" && p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const depositIncome = payments
    .filter((p) => p.type === "deposit" && p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const utilityIncome = payments
    .filter((p) => p.type === "utility" && p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const otherIncome = payments
    .filter((p) => p.type === "other" && p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const totalIncome = rentIncome + depositIncome + utilityIncome + otherIncome;

  // --- Unpaid Rent ---
  const unpaidPayments = await prisma.payment.findMany({
    where: { status: "pending" },
    include: {
      contract: {
        include: { room: true, tenant: true },
      },
    },
    orderBy: { month: "desc" },
  });

  const totalUnpaid = unpaidPayments.reduce((s, p) => s + p.amount, 0);

  // --- Occupancy ---
  const rooms = await prisma.room.findMany({
    include: {
      contracts: {
        where: { status: "active" },
        include: { tenant: true },
      },
    },
    orderBy: { number: "asc" },
  });

  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter((r) => r.status === "occupied").length;
  const vacantRooms = rooms.filter((r) => r.status === "vacant").length;
  const maintenanceRooms = rooms.filter((r) => r.status === "maintenance").length;
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  // --- Occupancy History (last 6 months) ---
  const occupancyHistory: { month: string; contracts: number }[] = [];
  const now = new Date();
  for (let i = -5; i <= 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    const rooms = await prisma.contract.groupBy({
      by: ["roomId"],
      where: {
        startDate: { lte: mEnd },
        OR: [{ endDate: null }, { endDate: { gte: mStart } }],
      },
    });

    occupancyHistory.push({ month: monthStr, contracts: rooms.length });
  }

  // --- Utility costs for the month ---
  const utilities = await prisma.utility.findMany({
    where: { month },
    include: { room: true },
    orderBy: { room: { number: "asc" } },
  });

  const totalUtilityCost = utilities.reduce((s, u) => s + u.totalAmount, 0);

  return {
    month,
    monthOptions: getMonthOptions(),
    income: {
      rent: rentIncome,
      deposit: depositIncome,
      utility: utilityIncome,
      other: otherIncome,
      total: totalIncome,
    },
    unpaidPayments,
    totalUnpaid,
    occupancy: {
      total: totalRooms,
      occupied: occupiedRooms,
      vacant: vacantRooms,
      maintenance: maintenanceRooms,
      rate: occupancyRate,
    },
    occupancyHistory,
    totalUtilityCost,
    rooms,
  };
}

export default function Reports({ loaderData }: Route.ComponentProps) {
  const {
    month,
    monthOptions,
    income,
    unpaidPayments,
    totalUnpaid,
    occupancy,
    occupancyHistory,
    totalUtilityCost,
  } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <PageContainer>
      <Header title="Reports" description="Monthly summaries and analytics" />

      {/* Month Selector */}
      <div className="mb-6">
        <Select
          id="month"
          options={monthOptions}
          value={month}
          onChange={(e) => setSearchParams({ month: e.target.value })}
        />
      </div>

      {/* Income Summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Total Income" value={formatCurrency(income.total)} />
        <Stat label="Rent" value={formatCurrency(income.rent)} />
        <Stat label="Deposits" value={formatCurrency(income.deposit)} />
        <Stat label="Utilities" value={formatCurrency(income.utility)} />
        <Stat label="Other" value={formatCurrency(income.other)} />
      </div>

      {/* Occupancy & Utility Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Occupancy Rate" value={`${occupancy.rate}%`} />
        <Stat label="Occupied / Total" value={`${occupancy.occupied} / ${occupancy.total}`} />
        <Stat label="Total Unpaid" value={formatCurrency(totalUnpaid)} />
        <Stat label="Utility Costs" value={formatCurrency(totalUtilityCost)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Occupancy History */}
        <Card>
          <CardHeader>
            <CardTitle>Occupancy History (6 months)</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {occupancyHistory.map((entry) => {
              const pct = occupancy.total > 0
                ? Math.round((entry.contracts / occupancy.total) * 100)
                : 0;
              return (
                <div key={entry.month} className="flex items-center gap-4">
                  <span className="w-16 text-sm text-gray-500 dark:text-gray-400">
                    {formatMonth(entry.month)}
                  </span>
                  <div className="flex-1">
                    <div className="h-6 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                      <div
                        className="flex h-full items-center rounded-full bg-primary-500 px-2 text-xs font-medium text-white transition-all"
                        style={{ width: `${Math.max(pct, 8)}%` }}
                      >
                        {entry.contracts}/{occupancy.total}
                      </div>
                    </div>
                  </div>
                  <span className="w-12 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Unpaid List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Unpaid Payments ({unpaidPayments.length})
            </CardTitle>
          </CardHeader>
          {unpaidPayments.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              All payments are up to date.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unpaidPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Badge variant="info">
                          Room {p.contract.room.number}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {p.contract.tenant.firstName}{" "}
                        {p.contract.tenant.lastName}
                      </TableCell>
                      <TableCell>{formatMonth(p.month)}</TableCell>
                      <TableCell>
                        <Badge variant="default">{p.type}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(p.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
