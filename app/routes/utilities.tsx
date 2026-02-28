import { useState } from "react";
import { Form, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/utilities";
import { prisma } from "~/lib/db.server";
import { requireAuth } from "~/lib/auth.server";
import { PageContainer } from "~/components/layout/page-container";
import { Header } from "~/components/layout/header";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select } from "~/components/ui/select";
import { Modal } from "~/components/ui/modal";
import { Badge } from "~/components/ui/badge";
import { Stat } from "~/components/ui/stat";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { formatCurrency, formatMonth } from "~/lib/utils";

export function meta() {
  return [{ title: "Utilities - NhaTro" }];
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -3; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push({ value, label: formatMonth(value) });
  }
  return options;
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const month = url.searchParams.get("month") || getCurrentMonth();

  const rooms = await prisma.room.findMany({
    orderBy: { number: "asc" },
  });

  const utilities = await prisma.utility.findMany({
    where: { month },
    include: { room: true },
    orderBy: { room: { number: "asc" } },
  });

  const settings = await prisma.setting.findMany({
    where: { key: { in: ["electric_rate", "water_rate"] } },
  });

  const electricRate = Number(
    settings.find((s) => s.key === "electric_rate")?.value || 3500
  );
  const waterRate = Number(
    settings.find((s) => s.key === "water_rate")?.value || 20000
  );

  // Merge rooms with utility data
  const utilityData = rooms.map((room) => {
    const util = utilities.find((u) => u.roomId === room.id);
    return {
      roomId: room.id,
      roomNumber: room.number,
      utilityId: util?.id || null,
      electricStart: util?.electricStart || 0,
      electricEnd: util?.electricEnd || 0,
      electricRate: util?.electricRate || electricRate,
      waterStart: util?.waterStart || 0,
      waterEnd: util?.waterEnd || 0,
      waterRate: util?.waterRate || waterRate,
      totalAmount: util?.totalAmount || 0,
    };
  });

  const totalElectric = utilityData.reduce(
    (s, u) => s + (u.electricEnd - u.electricStart) * u.electricRate,
    0
  );
  const totalWater = utilityData.reduce(
    (s, u) => s + (u.waterEnd - u.waterStart) * u.waterRate,
    0
  );
  const totalAll = utilityData.reduce((s, u) => s + u.totalAmount, 0);

  return {
    month,
    utilityData,
    electricRate,
    waterRate,
    stats: { totalElectric, totalWater, totalAll },
    monthOptions: getMonthOptions(),
  };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save-utility") {
    const roomId = Number(formData.get("roomId"));
    const month = formData.get("month") as string;
    const electricStart = Number(formData.get("electricStart") || 0);
    const electricEnd = Number(formData.get("electricEnd") || 0);
    const electricRate = Number(formData.get("electricRate") || 0);
    const waterStart = Number(formData.get("waterStart") || 0);
    const waterEnd = Number(formData.get("waterEnd") || 0);
    const waterRate = Number(formData.get("waterRate") || 0);

    const electricUsage = Math.max(0, electricEnd - electricStart);
    const waterUsage = Math.max(0, waterEnd - waterStart);
    const totalAmount = electricUsage * electricRate + waterUsage * waterRate;

    await prisma.utility.upsert({
      where: { roomId_month: { roomId, month } },
      create: {
        roomId,
        month,
        electricStart,
        electricEnd,
        electricRate,
        waterStart,
        waterEnd,
        waterRate,
        totalAmount,
      },
      update: {
        electricStart,
        electricEnd,
        electricRate,
        waterStart,
        waterEnd,
        waterRate,
        totalAmount,
      },
    });
  }

  if (intent === "generate-all") {
    const month = formData.get("month") as string;

    // Get previous month
    const [year, m] = month.split("-").map(Number);
    const prevDate = new Date(year, m - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    const rooms = await prisma.room.findMany();
    const prevUtilities = await prisma.utility.findMany({
      where: { month: prevMonth },
    });

    const settings = await prisma.setting.findMany({
      where: { key: { in: ["electric_rate", "water_rate"] } },
    });
    const electricRate = Number(
      settings.find((s) => s.key === "electric_rate")?.value || 3500
    );
    const waterRate = Number(
      settings.find((s) => s.key === "water_rate")?.value || 20000
    );

    for (const room of rooms) {
      const prev = prevUtilities.find((u) => u.roomId === room.id);
      await prisma.utility.upsert({
        where: { roomId_month: { roomId: room.id, month } },
        create: {
          roomId: room.id,
          month,
          electricStart: prev?.electricEnd || 0,
          electricEnd: prev?.electricEnd || 0,
          electricRate,
          waterStart: prev?.waterEnd || 0,
          waterEnd: prev?.waterEnd || 0,
          waterRate,
          totalAmount: 0,
        },
        update: {},
      });
    }
  }

  return { ok: true };
}

type UtilityRow = Awaited<ReturnType<typeof loader>>["utilityData"][number];

export default function Utilities({ loaderData }: Route.ComponentProps) {
  const { month, utilityData, electricRate, waterRate, stats, monthOptions } =
    loaderData;
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSubmitting = navigation.state === "submitting";

  const [editRow, setEditRow] = useState<UtilityRow | null>(null);

  return (
    <PageContainer>
      <Header
        title="Utilities"
        description="Track electricity and water usage per room"
        actions={
          <Form method="post">
            <input type="hidden" name="intent" value="generate-all" />
            <input type="hidden" name="month" value={month} />
            <Button variant="secondary" type="submit" disabled={isSubmitting}>
              Generate All Rooms
            </Button>
          </Form>
        }
      />

      {/* Month Selector */}
      <div className="mb-6">
        <Select
          id="month"
          options={monthOptions}
          value={month}
          onChange={(e) => setSearchParams({ month: e.target.value })}
        />
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Total Electric" value={formatCurrency(stats.totalElectric)} />
        <Stat label="Total Water" value={formatCurrency(stats.totalWater)} />
        <Stat label="Total Utilities" value={formatCurrency(stats.totalAll)} />
      </div>

      {/* Utility Table */}
      <Card>
        <CardHeader>
          <CardTitle>Utility Readings — {formatMonth(month)}</CardTitle>
        </CardHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Room</TableHead>
              <TableHead>Electric (kWh)</TableHead>
              <TableHead>Electric Cost</TableHead>
              <TableHead>Water (m³)</TableHead>
              <TableHead>Water Cost</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {utilityData.map((row) => {
              const electricUsage = Math.max(0, row.electricEnd - row.electricStart);
              const waterUsage = Math.max(0, row.waterEnd - row.waterStart);
              const electricCost = electricUsage * row.electricRate;
              const waterCost = waterUsage * row.waterRate;

              return (
                <TableRow key={row.roomId}>
                  <TableCell>
                    <Badge variant="info">Room {row.roomNumber}</Badge>
                  </TableCell>
                  <TableCell>
                    {row.utilityId ? (
                      <span>
                        {row.electricStart} → {row.electricEnd}{" "}
                        <span className="text-gray-400">({electricUsage})</span>
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.utilityId ? formatCurrency(electricCost) : "—"}
                  </TableCell>
                  <TableCell>
                    {row.utilityId ? (
                      <span>
                        {row.waterStart} → {row.waterEnd}{" "}
                        <span className="text-gray-400">({waterUsage})</span>
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.utilityId ? formatCurrency(waterCost) : "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {row.utilityId ? formatCurrency(row.totalAmount) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditRow(row)}
                    >
                      {row.utilityId ? "Edit" : "Enter"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Edit Utility Modal */}
      <Modal
        open={!!editRow}
        onClose={() => setEditRow(null)}
        title={editRow ? `Room ${editRow.roomNumber} — Utilities ${formatMonth(month)}` : ""}
        size="lg"
      >
        {editRow && (
          <Form method="post" onSubmit={() => setEditRow(null)}>
            <input type="hidden" name="intent" value="save-utility" />
            <input type="hidden" name="roomId" value={editRow.roomId} />
            <input type="hidden" name="month" value={month} />

            <div className="space-y-6">
              {/* Electricity */}
              <div>
                <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Electricity</h4>
                <div className="grid grid-cols-3 gap-4">
                  <Input
                    id="electricStart"
                    label="Start Reading (kWh)"
                    name="electricStart"
                    type="number"
                    step="0.1"
                    defaultValue={editRow.electricStart}
                  />
                  <Input
                    id="electricEnd"
                    label="End Reading (kWh)"
                    name="electricEnd"
                    type="number"
                    step="0.1"
                    defaultValue={editRow.electricEnd}
                  />
                  <Input
                    id="electricRate"
                    label="Rate (per kWh)"
                    name="electricRate"
                    type="number"
                    defaultValue={editRow.electricRate}
                  />
                </div>
              </div>

              {/* Water */}
              <div>
                <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Water</h4>
                <div className="grid grid-cols-3 gap-4">
                  <Input
                    id="waterStart"
                    label="Start Reading (m³)"
                    name="waterStart"
                    type="number"
                    step="0.1"
                    defaultValue={editRow.waterStart}
                  />
                  <Input
                    id="waterEnd"
                    label="End Reading (m³)"
                    name="waterEnd"
                    type="number"
                    step="0.1"
                    defaultValue={editRow.waterEnd}
                  />
                  <Input
                    id="waterRate"
                    label="Rate (per m³)"
                    name="waterRate"
                    type="number"
                    defaultValue={editRow.waterRate}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditRow(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </Form>
        )}
      </Modal>
    </PageContainer>
  );
}
