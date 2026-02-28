import { useState, useEffect, useRef } from "react";
import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/contracts";
import { prisma } from "~/lib/db.server";
import { PageContainer } from "~/components/layout/page-container";
import { Header } from "~/components/layout/header";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Modal } from "~/components/ui/modal";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { formatCurrency, formatDate } from "~/lib/utils";
import { findDuplicateId } from "~/lib/validate-id.server";
import { Alert } from "~/components/ui/alert";

export function meta() {
  return [{ title: "Contracts - Motel Manager" }];
}

export async function loader() {
  const contracts = await prisma.contract.findMany({
    include: {
      room: true,
      tenant: true,
      occupants: true,
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });

  const vacantRooms = await prisma.room.findMany({
    where: { status: "vacant" },
    orderBy: { number: "asc" },
  });

  const tenantsWithoutActiveContract = await prisma.tenant.findMany({
    where: {
      contracts: {
        none: { status: "active" },
      },
    },
    orderBy: { firstName: "asc" },
  });

  return { contracts, vacantRooms, tenantsWithoutActiveContract };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "move-in") {
    const roomId = Number(formData.get("roomId"));
    const tenantId = Number(formData.get("tenantId"));
    const monthlyRent = Number(formData.get("monthlyRent"));
    const deposit = Number(formData.get("deposit") || 0);
    const startDate = new Date(formData.get("startDate") as string);
    const notes = (formData.get("notes") as string) || "";

    // Parse occupants from form data
    const occupantCount = Number(formData.get("occupantCount") || 0);
    const occupants: {
      firstName: string;
      lastName: string;
      phone: string;
      idNumber: string;
      idType: string;
      relationship: string;
    }[] = [];

    for (let i = 0; i < occupantCount; i++) {
      const firstName = formData.get(`occupant_${i}_firstName`) as string;
      const lastName = formData.get(`occupant_${i}_lastName`) as string;
      if (firstName && lastName) {
        occupants.push({
          firstName,
          lastName,
          phone: (formData.get(`occupant_${i}_phone`) as string) || "",
          idNumber: (formData.get(`occupant_${i}_idNumber`) as string) || "",
          idType: (formData.get(`occupant_${i}_idType`) as string) || "",
          relationship: (formData.get(`occupant_${i}_relationship`) as string) || "",
        });
      }
    }

    // Validate max occupants
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (room && 1 + occupants.length > room.maxOccupants) {
      return { error: `Maximum ${room.maxOccupants} people per room (1 tenant + ${room.maxOccupants - 1} occupants)` };
    }

    // Validate unique ID numbers
    // Check for duplicates within the submitted occupants first
    const submittedIds = occupants.filter((o) => o.idNumber).map((o) => o.idNumber);
    const uniqueSubmittedIds = new Set(submittedIds);
    if (submittedIds.length !== uniqueSubmittedIds.size) {
      return { error: "Duplicate ID numbers within the submitted occupants" };
    }

    // Check each occupant's ID against existing tenants and occupants
    for (const occ of occupants) {
      if (occ.idNumber) {
        const duplicate = await findDuplicateId(occ.idNumber);
        if (duplicate) {
          return { error: `ID number "${occ.idNumber}" is already used by ${duplicate}` };
        }
      }
    }

    const contract = await prisma.contract.create({
      data: {
        roomId,
        tenantId,
        monthlyRent,
        deposit,
        startDate,
        status: "active",
        notes,
        occupants: {
          create: occupants,
        },
      },
    });

    await prisma.room.update({
      where: { id: roomId },
      data: { status: "occupied" },
    });
  }

  if (intent === "move-out") {
    const contractId = Number(formData.get("contractId"));
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (contract) {
      await prisma.$transaction([
        prisma.contract.update({
          where: { id: contractId },
          data: {
            status: "ended",
            endDate: new Date(),
          },
        }),
        prisma.room.update({
          where: { id: contract.roomId },
          data: { status: "vacant" },
        }),
      ]);
    }
  }

  return { ok: true };
}

interface OccupantRow {
  firstName: string;
  lastName: string;
  phone: string;
  idNumber: string;
  idType: string;
  relationship: string;
}

export default function Contracts({ loaderData, actionData }: Route.ComponentProps) {
  const { contracts, vacantRooms, tenantsWithoutActiveContract } = loaderData;
  const error = actionData && "error" in actionData ? actionData.error : null;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [showMoveIn, setShowMoveIn] = useState(false);
  const [moveOutContract, setMoveOutContract] = useState<
    (typeof contracts)[0] | null
  >(null);
  const [occupants, setOccupants] = useState<OccupantRow[]>([]);

  const activeContracts = contracts.filter((c) => c.status === "active");
  const endedContracts = contracts.filter((c) => c.status === "ended");

  // Close move-in modal when submission completes without error
  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (wasSubmitting.current && !isSubmitting && !error) {
      setShowMoveIn(false);
      setOccupants([]);
    }
    wasSubmitting.current = isSubmitting;
  }, [isSubmitting, error]);

  function addOccupant() {
    if (occupants.length < 4) {
      setOccupants([...occupants, { firstName: "", lastName: "", phone: "", idNumber: "", idType: "", relationship: "" }]);
    }
  }

  function removeOccupant(index: number) {
    setOccupants(occupants.filter((_, i) => i !== index));
  }

  function closeMoveIn() {
    setShowMoveIn(false);
    setOccupants([]);
  }

  return (
    <PageContainer>
      <Header
        title="Contracts"
        description="Manage rental contracts — move in & move out"
        actions={
          <Button
            onClick={() => setShowMoveIn(true)}
            disabled={vacantRooms.length === 0 || tenantsWithoutActiveContract.length === 0}
          >
            + Move In
          </Button>
        }
      />

      {vacantRooms.length === 0 && (
        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
          No vacant rooms available. A tenant must move out before a new move-in.
        </div>
      )}

      {tenantsWithoutActiveContract.length === 0 && vacantRooms.length > 0 && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          All tenants have active contracts. Add a new tenant first before moving in.
        </div>
      )}

      {error && (
        <Alert variant="error" className="mb-4">{error}</Alert>
      )}

      {/* Active Contracts */}
      <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
        Active Contracts ({activeContracts.length})
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Room</TableHead>
            <TableHead>Tenant</TableHead>
            <TableHead>People</TableHead>
            <TableHead>Monthly Rent</TableHead>
            <TableHead>Move-in Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activeContracts.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                No active contracts.
              </TableCell>
            </TableRow>
          )}
          {activeContracts.map((contract) => {
            const totalPeople = 1 + contract.occupants.length;
            return (
              <TableRow key={contract.id}>
                <TableCell>
                  <Badge variant="info">Room {contract.room.number}</Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {contract.tenant.firstName} {contract.tenant.lastName}
                </TableCell>
                <TableCell>
                  <Badge variant={totalPeople >= contract.room.maxOccupants ? "warning" : "default"}>
                    {totalPeople}/{contract.room.maxOccupants}
                  </Badge>
                </TableCell>
                <TableCell>{formatCurrency(contract.monthlyRent)}</TableCell>
                <TableCell>{formatDate(contract.startDate)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setMoveOutContract(contract)}
                  >
                    Move Out
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Ended Contracts */}
      {endedContracts.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Past Contracts ({endedContracts.length})
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>People</TableHead>
                <TableHead>Monthly Rent</TableHead>
                <TableHead>Move-in</TableHead>
                <TableHead>Move-out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endedContracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell>Room {contract.room.number}</TableCell>
                  <TableCell>
                    {contract.tenant.firstName} {contract.tenant.lastName}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">
                      {1 + contract.occupants.length}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(contract.monthlyRent)}</TableCell>
                  <TableCell>{formatDate(contract.startDate)}</TableCell>
                  <TableCell>
                    {contract.endDate ? formatDate(contract.endDate) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {/* Move-In Modal */}
      <Modal
        open={showMoveIn}
        onClose={closeMoveIn}
        title="Move In — New Contract"
        size="lg"
      >
        <Form method="post">
          <input type="hidden" name="intent" value="move-in" />
          <input type="hidden" name="occupantCount" value={occupants.length} />

          {error && showMoveIn && (
            <Alert variant="error" className="mb-4">{error}</Alert>
          )}

          <div className="space-y-4">
            <Select
              id="roomId"
              label="Room"
              name="roomId"
              required
              options={[
                { value: "", label: "Select a room..." },
                ...vacantRooms.map((r) => ({
                  value: String(r.id),
                  label: `Room ${r.number} — ${formatCurrency(r.rate)}/month (max ${r.maxOccupants} people)`,
                })),
              ]}
            />

            <Select
              id="tenantId"
              label="Main Tenant"
              name="tenantId"
              required
              options={[
                { value: "", label: "Select a tenant..." },
                ...tenantsWithoutActiveContract.map((t) => ({
                  value: String(t.id),
                  label: `${t.firstName} ${t.lastName}`,
                })),
              ]}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                id="monthlyRent"
                label="Monthly Rent"
                name="monthlyRent"
                type="number"
                required
                defaultValue={vacantRooms[0]?.rate || 3000000}
              />
              <Input
                id="deposit"
                label="Deposit"
                name="deposit"
                type="number"
                defaultValue={0}
              />
            </div>

            <Input
              id="startDate"
              label="Move-in Date"
              name="startDate"
              type="date"
              required
              defaultValue={new Date().toISOString().split("T")[0]}
            />

            <Textarea
              id="notes"
              label="Notes"
              name="notes"
              placeholder="Any notes about this contract..."
            />

            {/* Occupants Section */}
            <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Additional Occupants ({occupants.length}/4)
                </h4>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addOccupant}
                  disabled={occupants.length >= 4}
                >
                  + Add Person
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Max 5 people per room (1 main tenant + 4 occupants)
              </p>

              {occupants.map((occ, i) => (
                <div
                  key={i}
                  className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Person {i + 2}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeOccupant(i)}
                      className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      id={`occupant_${i}_firstName`}
                      label="First Name"
                      name={`occupant_${i}_firstName`}
                      required
                      placeholder="First name"
                    />
                    <Input
                      id={`occupant_${i}_lastName`}
                      label="Last Name"
                      name={`occupant_${i}_lastName`}
                      required
                      placeholder="Last name"
                    />
                    <Input
                      id={`occupant_${i}_phone`}
                      label="Phone"
                      name={`occupant_${i}_phone`}
                      placeholder="Phone"
                    />
                    <Select
                      id={`occupant_${i}_relationship`}
                      label="Relationship"
                      name={`occupant_${i}_relationship`}
                      options={[
                        { value: "", label: "Select..." },
                        { value: "spouse", label: "Spouse" },
                        { value: "family", label: "Family" },
                        { value: "friend", label: "Friend" },
                        { value: "roommate", label: "Roommate" },
                        { value: "other", label: "Other" },
                      ]}
                    />
                    <Select
                      id={`occupant_${i}_idType`}
                      label="ID Type"
                      name={`occupant_${i}_idType`}
                      options={[
                        { value: "", label: "Select..." },
                        { value: "CCCD", label: "CCCD" },
                        { value: "CMND", label: "CMND" },
                        { value: "Passport", label: "Passport" },
                        { value: "Other", label: "Other" },
                      ]}
                    />
                    <Input
                      id={`occupant_${i}_idNumber`}
                      label="ID Number"
                      name={`occupant_${i}_idNumber`}
                      placeholder="ID number"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={closeMoveIn}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Move In"}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Move-Out Confirm */}
      {moveOutContract && (
        <Form method="post" id="moveout-form">
          <input type="hidden" name="intent" value="move-out" />
          <input type="hidden" name="contractId" value={moveOutContract.id} />
        </Form>
      )}
      <ConfirmDialog
        open={!!moveOutContract}
        onClose={() => setMoveOutContract(null)}
        onConfirm={() => {
          const form = document.getElementById(
            "moveout-form"
          ) as HTMLFormElement;
          form?.requestSubmit();
          setMoveOutContract(null);
        }}
        title="Confirm Move Out"
        message={
          moveOutContract
            ? `Move out ${moveOutContract.tenant.firstName} ${moveOutContract.tenant.lastName}${
                moveOutContract.occupants.length > 0
                  ? ` and ${moveOutContract.occupants.length} occupant${moveOutContract.occupants.length > 1 ? "s" : ""}`
                  : ""
              } from Room ${moveOutContract.room.number}? This will end the contract.`
            : ""
        }
        confirmLabel="Move Out"
      />
    </PageContainer>
  );
}
