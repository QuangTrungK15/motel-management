import { useState } from "react";
import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/rooms";
import { prisma } from "~/lib/db.server";
import { PageContainer } from "~/components/layout/page-container";
import { Header } from "~/components/layout/header";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Modal } from "~/components/ui/modal";
import { Input } from "~/components/ui/input";
import { Select } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { formatCurrency, formatDate } from "~/lib/utils";
import { requireAuth } from "~/lib/auth.server";

export function meta() {
  return [{ title: "Rooms - Motel Manager" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const rooms = await prisma.room.findMany({
    include: {
      contracts: {
        include: {
          tenant: true,
          occupants: true,
          payments: {
            orderBy: { month: "desc" },
            take: 3,
          },
        },
        orderBy: { startDate: "desc" },
      },
    },
    orderBy: { number: "asc" },
  });

  return { rooms };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update-room") {
    const id = Number(formData.get("id"));
    const rate = Number(formData.get("rate"));
    const status = formData.get("status") as string;
    const notes = formData.get("notes") as string;

    await prisma.room.update({
      where: { id },
      data: { rate, status, notes },
    });
  }

  return { ok: true };
}

const statusConfig = {
  vacant: { label: "Vacant", variant: "success" as const, color: "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20" },
  occupied: { label: "Occupied", variant: "info" as const, color: "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20" },
  maintenance: { label: "Maintenance", variant: "warning" as const, color: "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20" },
};

type RoomWithRelations = Awaited<ReturnType<typeof loader>>["rooms"][number];

export default function Rooms({ loaderData }: Route.ComponentProps) {
  const { rooms } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [selectedRoom, setSelectedRoom] = useState<RoomWithRelations | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const occupied = rooms.filter((r) => r.status === "occupied").length;
  const vacant = rooms.filter((r) => r.status === "vacant").length;
  const maintenance = rooms.filter((r) => r.status === "maintenance").length;

  const activeContract = selectedRoom?.contracts.find((c) => c.status === "active");
  const pastContracts = selectedRoom?.contracts.filter((c) => c.status === "ended") || [];

  function closeModal() {
    setSelectedRoom(null);
    setIsEditing(false);
  }

  return (
    <PageContainer>
      <Header
        title="Rooms"
        description="Manage your 10 rooms"
      />

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <span className="h-3 w-3 rounded-full bg-green-400" />
          <span className="text-sm text-gray-600 dark:text-gray-300">Vacant: {vacant}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <span className="h-3 w-3 rounded-full bg-blue-400" />
          <span className="text-sm text-gray-600 dark:text-gray-300">Occupied: {occupied}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <span className="h-3 w-3 rounded-full bg-yellow-400" />
          <span className="text-sm text-gray-600 dark:text-gray-300">Maintenance: {maintenance}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {rooms.map((room) => {
          const config = statusConfig[room.status as keyof typeof statusConfig];
          const activeC = room.contracts.find((c) => c.status === "active");
          const activeTenant = activeC?.tenant;
          const totalPeople = activeC ? 1 + activeC.occupants.length : 0;

          return (
            <Card
              key={room.id}
              className={`cursor-pointer transition-all hover:shadow-md ${config.color}`}
              onClick={() => {
                setSelectedRoom(room);
                setIsEditing(false);
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">#{room.number}</p>
                <Badge variant={config.variant}>{config.label}</Badge>
              </div>

              <div className="mt-3 space-y-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {formatCurrency(room.rate)}/month
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Floor {room.floor}
                </p>
              </div>

              {activeTenant && (
                <div className="mt-3 rounded-lg bg-white/70 px-3 py-2 dark:bg-white/10">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {activeTenant.firstName} {activeTenant.lastName}
                    </p>
                    <Badge variant="default" className="text-[10px]">
                      {totalPeople}/{room.maxOccupants}
                    </Badge>
                  </div>
                  {activeTenant.phone && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{activeTenant.phone}</p>
                  )}
                </div>
              )}

              {!activeTenant && room.status === "vacant" && (
                <p className="mt-3 text-sm italic text-gray-400">No tenant</p>
              )}

              {room.notes && (
                <p className="mt-2 truncate text-xs text-gray-400">{room.notes}</p>
              )}
            </Card>
          );
        })}
      </div>

      {/* Room Detail / Edit Modal */}
      <Modal
        open={!!selectedRoom}
        onClose={closeModal}
        title={selectedRoom ? `Room #${selectedRoom.number}` : ""}
        size="lg"
      >
        {selectedRoom && !isEditing && (
          <div>
            {/* Room Info */}
            <div className="grid grid-cols-2 gap-4">
              <DetailItem label="Status">
                <Badge variant={statusConfig[selectedRoom.status as keyof typeof statusConfig].variant}>
                  {statusConfig[selectedRoom.status as keyof typeof statusConfig].label}
                </Badge>
              </DetailItem>
              <DetailItem label="Floor">{selectedRoom.floor}</DetailItem>
              <DetailItem label="Monthly Rate">{formatCurrency(selectedRoom.rate)}</DetailItem>
              <DetailItem label="Created">{formatDate(selectedRoom.createdAt)}</DetailItem>
            </div>

            {selectedRoom.notes && (
              <div className="mt-4">
                <DetailItem label="Notes">{selectedRoom.notes}</DetailItem>
              </div>
            )}

            {/* Current Tenant */}
            <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Current Tenant</h4>
                {activeContract && (
                  <Badge variant={1 + activeContract.occupants.length >= selectedRoom.maxOccupants ? "warning" : "info"}>
                    {1 + activeContract.occupants.length}/{selectedRoom.maxOccupants} people
                  </Badge>
                )}
              </div>
              {activeContract ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                  <div className="grid grid-cols-2 gap-3">
                    <DetailItem label="Name">
                      {activeContract.tenant.firstName} {activeContract.tenant.lastName}
                    </DetailItem>
                    <DetailItem label="Phone">
                      {activeContract.tenant.phone || "—"}
                    </DetailItem>
                    <DetailItem label="Email">
                      {activeContract.tenant.email || "—"}
                    </DetailItem>
                    <DetailItem label="ID">
                      {activeContract.tenant.idNumber
                        ? `${activeContract.tenant.idType} — ${activeContract.tenant.idNumber}`
                        : "—"}
                    </DetailItem>
                    <DetailItem label="Monthly Rent">
                      {formatCurrency(activeContract.monthlyRent)}
                    </DetailItem>
                    <DetailItem label="Deposit">
                      {formatCurrency(activeContract.deposit)}
                    </DetailItem>
                    <DetailItem label="Move-in Date">
                      {formatDate(activeContract.startDate)}
                    </DetailItem>
                  </div>

                  {/* Occupants */}
                  {activeContract.occupants.length > 0 && (
                    <div className="mt-4 border-t border-blue-200 pt-3 dark:border-blue-800">
                      <p className="text-xs font-semibold text-blue-800 mb-2 dark:text-blue-300">
                        Occupants ({activeContract.occupants.length})
                      </p>
                      <div className="space-y-2">
                        {activeContract.occupants.map((occ) => (
                          <div key={occ.id} className="flex items-center justify-between text-xs">
                            <div>
                              <span className="font-medium text-blue-900 dark:text-blue-300">
                                {occ.firstName} {occ.lastName}
                              </span>
                              {occ.relationship && (
                                <span className="ml-2 text-blue-600 dark:text-blue-400">({occ.relationship})</span>
                              )}
                            </div>
                            <div className="text-blue-700 dark:text-blue-400">
                              {occ.phone && <span>{occ.phone}</span>}
                              {occ.idNumber && <span className="ml-2">{occ.idType} {occ.idNumber}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Payments */}
                  {activeContract.payments.length > 0 && (
                    <div className="mt-4 border-t border-blue-200 pt-3 dark:border-blue-800">
                      <p className="text-xs font-semibold text-blue-800 mb-2 dark:text-blue-300">Recent Payments</p>
                      <div className="space-y-1">
                        {activeContract.payments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-xs">
                            <span className="text-blue-700 dark:text-blue-400">{p.month} — {p.type}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-blue-900 dark:text-blue-300">{formatCurrency(p.amount)}</span>
                              <Badge variant={p.status === "paid" ? "success" : "warning"} className="text-[10px]">
                                {p.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm italic text-gray-400">No current tenant</p>
              )}
            </div>

            {/* Past Contracts */}
            {pastContracts.length > 0 && (
              <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 dark:text-gray-100">
                  Past Tenants ({pastContracts.length})
                </h4>
                <div className="space-y-2">
                  {pastContracts.map((contract) => (
                    <div
                      key={contract.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-700/50"
                    >
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {contract.tenant.firstName} {contract.tenant.lastName}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500">
                        {formatDate(contract.startDate)}
                        {contract.endDate ? ` — ${formatDate(contract.endDate)}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
              <Button variant="secondary" onClick={closeModal}>
                Close
              </Button>
              <Button onClick={() => setIsEditing(true)}>
                Edit Room
              </Button>
            </div>
          </div>
        )}

        {/* Edit Form */}
        {selectedRoom && isEditing && (
          <Form method="post" onSubmit={closeModal}>
            <input type="hidden" name="intent" value="update-room" />
            <input type="hidden" name="id" value={selectedRoom.id} />

            <div className="space-y-4">
              <Input
                id="rate"
                label="Monthly Rate"
                name="rate"
                type="number"
                defaultValue={selectedRoom.rate}
              />

              <Select
                id="status"
                label="Status"
                name="status"
                defaultValue={selectedRoom.status}
                options={[
                  { value: "vacant", label: "Vacant" },
                  { value: "occupied", label: "Occupied" },
                  { value: "maintenance", label: "Maintenance" },
                ]}
              />

              <Textarea
                id="notes"
                label="Notes"
                name="notes"
                defaultValue={selectedRoom.notes}
                placeholder="Any notes about this room..."
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEditing(false)}
              >
                Back
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </Form>
        )}
      </Modal>
    </PageContainer>
  );
}

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide dark:text-gray-500">{label}</p>
      <div className="mt-0.5 text-sm text-gray-900 dark:text-gray-200">{children}</div>
    </div>
  );
}
