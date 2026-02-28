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
import { requireAuth } from "~/lib/auth.server";
import { useLanguage } from "~/lib/language";

export function meta() {
  return [{ title: "Contracts - NhaTro" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
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
  await requireAuth(request);
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
      return { error: "MAX_OCCUPANTS", params: { max: String(room.maxOccupants), rest: String(room.maxOccupants - 1) } };
    }

    // Validate unique ID numbers
    // Check for duplicates within the submitted occupants first
    const submittedIds = occupants.filter((o) => o.idNumber).map((o) => o.idNumber);
    const uniqueSubmittedIds = new Set(submittedIds);
    if (submittedIds.length !== uniqueSubmittedIds.size) {
      return { error: "DUPLICATE_OCCUPANT_IDS" };
    }

    // Check each occupant's ID against existing tenants and occupants
    for (const occ of occupants) {
      if (occ.idNumber) {
        const duplicate = await findDuplicateId(occ.idNumber);
        if (duplicate) {
          return { error: "DUPLICATE_ID", params: { id: occ.idNumber, name: duplicate } };
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
  const { t } = useLanguage();
  const errorCode = actionData && "error" in actionData ? actionData.error as string : null;
  const errorParams = actionData && "params" in actionData ? actionData.params as Record<string, string> : undefined;
  const error = errorCode ? t("errors." + errorCode, errorParams) : null;
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
        title={t("contracts.title")}
        description={t("contracts.description")}
        actions={
          <Button
            onClick={() => setShowMoveIn(true)}
            disabled={vacantRooms.length === 0 || tenantsWithoutActiveContract.length === 0}
          >
            {t("contracts.moveIn")}
          </Button>
        }
      />

      {vacantRooms.length === 0 && (
        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
          {t("contracts.noVacantRooms")}
        </div>
      )}

      {tenantsWithoutActiveContract.length === 0 && vacantRooms.length > 0 && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          {t("contracts.allTenantsHaveContracts")}
        </div>
      )}

      {error && (
        <Alert variant="error" className="mb-4">{error}</Alert>
      )}

      {/* Active Contracts */}
      <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {t("contracts.activeContracts", { count: activeContracts.length })}
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("common.roomLabel")}</TableHead>
            <TableHead>{t("reports.tenant")}</TableHead>
            <TableHead>{t("contracts.people")}</TableHead>
            <TableHead>{t("contracts.monthlyRent")}</TableHead>
            <TableHead>{t("contracts.moveInDate")}</TableHead>
            <TableHead className="text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activeContracts.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                {t("contracts.noActiveContracts")}
              </TableCell>
            </TableRow>
          )}
          {activeContracts.map((contract) => {
            const totalPeople = 1 + contract.occupants.length;
            return (
              <TableRow key={contract.id}>
                <TableCell>
                  <Badge variant="info">{t("common.room", { number: contract.room.number })}</Badge>
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
                    {t("contracts.moveOut")}
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
            {t("contracts.pastContracts", { count: endedContracts.length })}
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.roomLabel")}</TableHead>
                <TableHead>{t("reports.tenant")}</TableHead>
                <TableHead>{t("contracts.people")}</TableHead>
                <TableHead>{t("contracts.monthlyRent")}</TableHead>
                <TableHead>{t("contracts.moveInCol")}</TableHead>
                <TableHead>{t("contracts.moveOutCol")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endedContracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell>{t("common.room", { number: contract.room.number })}</TableCell>
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
                    {contract.endDate ? formatDate(contract.endDate) : "\u2014"}
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
        title={t("contracts.moveInTitle")}
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
              label={t("contracts.roomLabel")}
              name="roomId"
              required
              options={[
                { value: "", label: t("contracts.selectRoom") },
                ...vacantRooms.map((r) => ({
                  value: String(r.id),
                  label: t("contracts.roomOption", { number: r.number, rate: formatCurrency(r.rate), max: r.maxOccupants }),
                })),
              ]}
            />

            <Select
              id="tenantId"
              label={t("contracts.mainTenant")}
              name="tenantId"
              required
              options={[
                { value: "", label: t("contracts.selectTenant") },
                ...tenantsWithoutActiveContract.map((tn) => ({
                  value: String(tn.id),
                  label: `${tn.firstName} ${tn.lastName}`,
                })),
              ]}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                id="monthlyRent"
                label={t("contracts.monthlyRentLabel")}
                name="monthlyRent"
                type="number"
                required
                defaultValue={vacantRooms[0]?.rate || 3000000}
              />
              <Input
                id="deposit"
                label={t("contracts.depositLabel")}
                name="deposit"
                type="number"
                defaultValue={0}
              />
            </div>

            <Input
              id="startDate"
              label={t("contracts.moveInDateLabel")}
              name="startDate"
              type="date"
              required
              defaultValue={new Date().toISOString().split("T")[0]}
            />

            <Textarea
              id="notes"
              label={t("common.notes")}
              name="notes"
              placeholder={t("common.notes")}
            />

            {/* Occupants Section */}
            <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {t("contracts.additionalOccupants", { count: occupants.length })}
                </h4>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addOccupant}
                  disabled={occupants.length >= 4}
                >
                  {t("contracts.addPerson")}
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {t("contracts.maxPeopleNote")}
              </p>

              {occupants.map((occ, i) => (
                <div
                  key={i}
                  className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t("contracts.person", { number: i + 2 })}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeOccupant(i)}
                      className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                      {t("common.remove")}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      id={`occupant_${i}_firstName`}
                      label={t("tenants.firstName")}
                      name={`occupant_${i}_firstName`}
                      required
                      placeholder={t("tenants.firstName")}
                    />
                    <Input
                      id={`occupant_${i}_lastName`}
                      label={t("tenants.lastName")}
                      name={`occupant_${i}_lastName`}
                      required
                      placeholder={t("tenants.lastName")}
                    />
                    <Input
                      id={`occupant_${i}_phone`}
                      label={t("common.phone")}
                      name={`occupant_${i}_phone`}
                      placeholder={t("common.phone")}
                    />
                    <Select
                      id={`occupant_${i}_relationship`}
                      label={t("contracts.relationship")}
                      name={`occupant_${i}_relationship`}
                      options={[
                        { value: "", label: t("common.select") },
                        { value: "spouse", label: t("contracts.spouse") },
                        { value: "family", label: t("contracts.family") },
                        { value: "friend", label: t("contracts.friend") },
                        { value: "roommate", label: t("contracts.roommate") },
                        { value: "other", label: t("contracts.other") },
                      ]}
                    />
                    <Select
                      id={`occupant_${i}_idType`}
                      label={t("tenants.idType")}
                      name={`occupant_${i}_idType`}
                      options={[
                        { value: "", label: t("common.select") },
                        { value: "CCCD", label: "CCCD" },
                        { value: "CMND", label: "CMND" },
                        { value: "Passport", label: "Passport" },
                        { value: "Other", label: t("contracts.other") },
                      ]}
                    />
                    <Input
                      id={`occupant_${i}_idNumber`}
                      label={t("tenants.idNumber")}
                      name={`occupant_${i}_idNumber`}
                      placeholder={t("tenants.idNumberPlaceholder")}
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
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("contracts.creating") : t("contracts.moveInSubmit")}
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
        title={t("contracts.confirmMoveOutTitle")}
        message={
          moveOutContract
            ? moveOutContract.occupants.length > 0
              ? t("contracts.moveOutConfirmWithOccupants", {
                  name: `${moveOutContract.tenant.firstName} ${moveOutContract.tenant.lastName}`,
                  count: moveOutContract.occupants.length,
                  room: moveOutContract.room.number,
                })
              : t("contracts.moveOutConfirm", {
                  name: `${moveOutContract.tenant.firstName} ${moveOutContract.tenant.lastName}`,
                  room: moveOutContract.room.number,
                })
            : ""
        }
        confirmLabel={t("contracts.moveOut")}
      />
    </PageContainer>
  );
}
