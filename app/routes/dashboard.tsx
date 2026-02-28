import type { Route } from "./+types/dashboard";
import { prisma } from "~/lib/db.server";
import { requireAuth } from "~/lib/auth.server";
import { PageContainer } from "~/components/layout/page-container";
import { Header } from "~/components/layout/header";
import { Stat } from "~/components/ui/stat";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { formatCurrency } from "~/lib/utils";

export function meta() {
  return [
    { title: "Dashboard - Motel Manager" },
    { name: "description", content: "Motel management dashboard" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const rooms = await prisma.room.findMany({
    include: {
      contracts: {
        where: { status: "active" },
        include: { tenant: true, occupants: true },
      },
    },
    orderBy: { number: "asc" },
  });

  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter((r) => r.status === "occupied").length;
  const vacantRooms = rooms.filter((r) => r.status === "vacant").length;
  const maintenanceRooms = rooms.filter((r) => r.status === "maintenance").length;

  const activeContracts = await prisma.contract.count({
    where: { status: "active" },
  });

  const totalTenants = await prisma.tenant.count();

  return {
    rooms,
    stats: {
      totalRooms,
      occupiedRooms,
      vacantRooms,
      maintenanceRooms,
      activeContracts,
      totalTenants,
    },
  };
}

const statusConfig = {
  vacant: { label: "Vacant", variant: "success" as const },
  occupied: { label: "Occupied", variant: "info" as const },
  maintenance: { label: "Maintenance", variant: "warning" as const },
};

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { rooms, stats } = loaderData;

  return (
    <PageContainer>
      <Header
        title="Dashboard"
        description="Overview of your motel"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Rooms" value={stats.totalRooms} />
        <Stat label="Occupied" value={stats.occupiedRooms} />
        <Stat label="Vacant" value={stats.vacantRooms} />
        <Stat label="Active Contracts" value={stats.activeContracts} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Room Overview</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {rooms.map((room) => {
            const config = statusConfig[room.status as keyof typeof statusConfig];
            const activeC = room.contracts[0];
            const activeTenant = activeC?.tenant;
            const totalPeople = activeC ? 1 + activeC.occupants.length : 0;

            return (
              <div
                key={room.id}
                className="rounded-lg border border-gray-200 p-4 text-center transition-shadow hover:shadow-md dark:border-gray-700"
              >
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Room {room.number}
                </p>
                <Badge variant={config.variant} className="mt-2">
                  {config.label}
                </Badge>
                {activeTenant && (
                  <>
                    <p className="mt-2 truncate text-sm text-gray-500 dark:text-gray-400">
                      {activeTenant.firstName} {activeTenant.lastName}
                    </p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      {totalPeople}/{room.maxOccupants} people
                    </p>
                  </>
                )}
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {formatCurrency(room.rate)}
                </p>
              </div>
            );
          })}
        </div>
      </Card>
    </PageContainer>
  );
}
