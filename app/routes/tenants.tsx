import { useState, useEffect, useRef } from "react";
import { Form, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/tenants";
import { prisma } from "~/lib/db.server";
import { PageContainer } from "~/components/layout/page-container";
import { Header } from "~/components/layout/header";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Modal } from "~/components/ui/modal";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Alert } from "~/components/ui/alert";
import { formatDate } from "~/lib/utils";
import { findDuplicateId } from "~/lib/validate-id.server";
import { requireAuth } from "~/lib/auth.server";
import { useLanguage } from "~/lib/language";

export function meta() {
  return [{ title: "Tenants - NhaTro" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";

  const tenants = await prisma.tenant.findMany({
    where: search
      ? {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { phone: { contains: search } },
            { idNumber: { contains: search } },
          ],
        }
      : undefined,
    include: {
      contracts: {
        where: { status: "active" },
        include: { room: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return { tenants, search };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const idNumber = (formData.get("idNumber") as string) || "";
    if (idNumber) {
      const duplicate = await findDuplicateId(idNumber);
      if (duplicate) {
        return { error: "DUPLICATE_ID", params: { id: idNumber, name: duplicate } };
      }
    }
    await prisma.tenant.create({
      data: {
        firstName: formData.get("firstName") as string,
        lastName: formData.get("lastName") as string,
        phone: (formData.get("phone") as string) || "",
        email: (formData.get("email") as string) || "",
        idNumber,
        idType: (formData.get("idType") as string) || "",
        notes: (formData.get("notes") as string) || "",
      },
    });
  }

  if (intent === "update") {
    const id = Number(formData.get("id"));
    const idNumber = (formData.get("idNumber") as string) || "";
    if (idNumber) {
      const duplicate = await findDuplicateId(idNumber, { excludeTenantId: id });
      if (duplicate) {
        return { error: "DUPLICATE_ID", params: { id: idNumber, name: duplicate } };
      }
    }
    await prisma.tenant.update({
      where: { id },
      data: {
        firstName: formData.get("firstName") as string,
        lastName: formData.get("lastName") as string,
        phone: (formData.get("phone") as string) || "",
        email: (formData.get("email") as string) || "",
        idNumber,
        idType: (formData.get("idType") as string) || "",
        notes: (formData.get("notes") as string) || "",
      },
    });
  }

  if (intent === "delete") {
    const id = Number(formData.get("id"));
    // Check if tenant has active contracts
    const activeContracts = await prisma.contract.count({
      where: { tenantId: id, status: "active" },
    });
    if (activeContracts > 0) {
      return { error: "TENANT_HAS_ACTIVE_CONTRACTS" };
    }
    // Delete related payments, contracts, then tenant
    const contracts = await prisma.contract.findMany({
      where: { tenantId: id },
      select: { id: true },
    });
    const contractIds = contracts.map((c) => c.id);

    await prisma.$transaction([
      prisma.occupant.deleteMany({ where: { contractId: { in: contractIds } } }),
      prisma.payment.deleteMany({ where: { contractId: { in: contractIds } } }),
      prisma.contract.deleteMany({ where: { tenantId: id } }),
      prisma.tenant.delete({ where: { id } }),
    ]);
  }

  return { ok: true };
}

type TenantWithContracts = Awaited<
  ReturnType<typeof loader>
>["tenants"][number];

export default function Tenants({ loaderData, actionData }: Route.ComponentProps) {
  const { tenants, search } = loaderData;
  const { t } = useLanguage();
  const errorCode = actionData && "error" in actionData ? actionData.error as string : null;
  const errorParams = actionData && "params" in actionData ? actionData.params as Record<string, string> : undefined;
  const error = errorCode ? t("errors." + errorCode, errorParams) : null;
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSubmitting = navigation.state === "submitting";

  const [showCreate, setShowCreate] = useState(false);
  const [editTenant, setEditTenant] = useState<TenantWithContracts | null>(null);
  const [deleteTenant, setDeleteTenant] = useState<TenantWithContracts | null>(null);

  // Close modals when submission completes without error
  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (wasSubmitting.current && !isSubmitting && !error) {
      setShowCreate(false);
      setEditTenant(null);
    }
    wasSubmitting.current = isSubmitting;
  }, [isSubmitting, error]);

  return (
    <PageContainer>
      <Header
        title={t("tenants.title")}
        description={t("tenants.count", { count: tenants.length })}
        actions={
          <Button onClick={() => setShowCreate(true)}>{t("tenants.addTenant")}</Button>
        }
      />

      {error && (
        <Alert variant="error" className="mb-4">{error}</Alert>
      )}

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder={t("tenants.searchPlaceholder")}
          defaultValue={search}
          onChange={(e) => {
            const val = e.target.value;
            if (val) {
              setSearchParams({ search: val });
            } else {
              setSearchParams({});
            }
          }}
        />
      </div>

      {/* Tenant Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("common.name")}</TableHead>
            <TableHead>{t("common.phone")}</TableHead>
            <TableHead>{t("tenants.idNumber")}</TableHead>
            <TableHead>{t("common.roomLabel")}</TableHead>
            <TableHead>{t("tenants.since")}</TableHead>
            <TableHead className="text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                {t("tenants.noTenants")}
              </TableCell>
            </TableRow>
          )}
          {tenants.map((tenant) => {
            const activeContract = tenant.contracts[0];
            return (
              <TableRow key={tenant.id}>
                <TableCell className="font-medium">
                  {tenant.firstName} {tenant.lastName}
                </TableCell>
                <TableCell>{tenant.phone || "\u2014"}</TableCell>
                <TableCell>
                  {tenant.idNumber ? (
                    <span>
                      {tenant.idType && (
                        <Badge variant="default" className="mr-2">
                          {tenant.idType}
                        </Badge>
                      )}
                      {tenant.idNumber}
                    </span>
                  ) : (
                    "\u2014"
                  )}
                </TableCell>
                <TableCell>
                  {activeContract ? (
                    <Badge variant="info">{t("common.room", { number: activeContract.room.number })}</Badge>
                  ) : (
                    <span className="text-gray-400">\u2014</span>
                  )}
                </TableCell>
                <TableCell>{formatDate(tenant.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditTenant(tenant)}
                    >
                      {t("common.edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTenant(tenant)}
                      className="text-red-600 hover:text-red-700"
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t("tenants.addNewTitle")}
        size="lg"
      >
        <TenantForm
          onClose={() => setShowCreate(false)}
          isSubmitting={isSubmitting}
          intent="create"
          error={error}
          t={t}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editTenant}
        onClose={() => setEditTenant(null)}
        title={t("tenants.editTitle")}
        size="lg"
      >
        {editTenant && (
          <TenantForm
            tenant={editTenant}
            onClose={() => setEditTenant(null)}
            isSubmitting={isSubmitting}
            intent="update"
            error={error}
            t={t}
          />
        )}
      </Modal>

      {/* Delete Confirm */}
      {deleteTenant && (
        <Form method="post" id="delete-form">
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={deleteTenant.id} />
        </Form>
      )}
      <ConfirmDialog
        open={!!deleteTenant}
        onClose={() => setDeleteTenant(null)}
        onConfirm={() => {
          const form = document.getElementById("delete-form") as HTMLFormElement;
          form?.requestSubmit();
          setDeleteTenant(null);
        }}
        title={t("tenants.deleteTitle")}
        message={
          deleteTenant
            ? t("tenants.deleteConfirm", { name: `${deleteTenant.firstName} ${deleteTenant.lastName}` })
            : ""
        }
      />
    </PageContainer>
  );
}

function TenantForm({
  tenant,
  onClose,
  isSubmitting,
  intent,
  error,
  t,
}: {
  tenant?: TenantWithContracts;
  onClose: () => void;
  isSubmitting: boolean;
  intent: string;
  error?: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value={intent} />
      {tenant && <input type="hidden" name="id" value={tenant.id} />}

      {error && (
        <Alert variant="error" className="mb-4">{error}</Alert>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Input
          id="firstName"
          label={t("tenants.firstName")}
          name="firstName"
          required
          defaultValue={tenant?.firstName}
          placeholder={t("tenants.firstName")}
        />
        <Input
          id="lastName"
          label={t("tenants.lastName")}
          name="lastName"
          required
          defaultValue={tenant?.lastName}
          placeholder={t("tenants.lastName")}
        />
        <Input
          id="phone"
          label={t("common.phone")}
          name="phone"
          defaultValue={tenant?.phone}
          placeholder={t("tenants.phonePlaceholder")}
        />
        <Input
          id="email"
          label={t("common.email")}
          name="email"
          type="email"
          defaultValue={tenant?.email}
          placeholder={t("tenants.emailPlaceholder")}
        />
        <Select
          id="idType"
          label={t("tenants.idType")}
          name="idType"
          defaultValue={tenant?.idType || ""}
          options={[
            { value: "", label: t("common.select") },
            { value: "CCCD", label: "CCCD" },
            { value: "CMND", label: "CMND" },
            { value: "Passport", label: "Passport" },
            { value: "Other", label: t("contracts.other") },
          ]}
        />
        <Input
          id="idNumber"
          label={t("tenants.idNumber")}
          name="idNumber"
          defaultValue={tenant?.idNumber}
          placeholder={t("tenants.idNumberPlaceholder")}
        />
      </div>

      <div className="mt-4">
        <Textarea
          id="notes"
          label={t("common.notes")}
          name="notes"
          defaultValue={tenant?.notes}
          placeholder={t("tenants.notesPlaceholder")}
        />
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("common.saving") : tenant ? t("common.saveChanges") : t("tenants.addTenantSubmit")}
        </Button>
      </div>
    </Form>
  );
}
