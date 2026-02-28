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

export function meta() {
  return [{ title: "Tenants - Motel Manager" }];
}

export async function loader({ request }: Route.LoaderArgs) {
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
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const idNumber = (formData.get("idNumber") as string) || "";
    if (idNumber) {
      const duplicate = await findDuplicateId(idNumber);
      if (duplicate) {
        return { error: `ID number "${idNumber}" is already used by ${duplicate}` };
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
        return { error: `ID number "${idNumber}" is already used by ${duplicate}` };
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
      return { error: "Cannot delete tenant with active contracts" };
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
  const error = actionData && "error" in actionData ? actionData.error : null;
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
        title="Tenants"
        description={`${tenants.length} tenant${tenants.length !== 1 ? "s" : ""}`}
        actions={
          <Button onClick={() => setShowCreate(true)}>+ Add Tenant</Button>
        }
      />

      {error && (
        <Alert variant="error" className="mb-4">{error}</Alert>
      )}

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Search by name, phone, or ID..."
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
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>ID Number</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Since</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                No tenants found.
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
                <TableCell>{tenant.phone || "—"}</TableCell>
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
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {activeContract ? (
                    <Badge variant="info">Room {activeContract.room.number}</Badge>
                  ) : (
                    <span className="text-gray-400">—</span>
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
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTenant(tenant)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Delete
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
        title="Add New Tenant"
        size="lg"
      >
        <TenantForm
          onClose={() => setShowCreate(false)}
          isSubmitting={isSubmitting}
          intent="create"
          error={error}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editTenant}
        onClose={() => setEditTenant(null)}
        title="Edit Tenant"
        size="lg"
      >
        {editTenant && (
          <TenantForm
            tenant={editTenant}
            onClose={() => setEditTenant(null)}
            isSubmitting={isSubmitting}
            intent="update"
            error={error}
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
        title="Delete Tenant"
        message={
          deleteTenant
            ? `Are you sure you want to delete ${deleteTenant.firstName} ${deleteTenant.lastName}? This cannot be undone.`
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
}: {
  tenant?: TenantWithContracts;
  onClose: () => void;
  isSubmitting: boolean;
  intent: string;
  error?: string | null;
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
          label="First Name"
          name="firstName"
          required
          defaultValue={tenant?.firstName}
          placeholder="First name"
        />
        <Input
          id="lastName"
          label="Last Name"
          name="lastName"
          required
          defaultValue={tenant?.lastName}
          placeholder="Last name"
        />
        <Input
          id="phone"
          label="Phone"
          name="phone"
          defaultValue={tenant?.phone}
          placeholder="Phone number"
        />
        <Input
          id="email"
          label="Email"
          name="email"
          type="email"
          defaultValue={tenant?.email}
          placeholder="Email address"
        />
        <Select
          id="idType"
          label="ID Type"
          name="idType"
          defaultValue={tenant?.idType || ""}
          options={[
            { value: "", label: "Select..." },
            { value: "CCCD", label: "CCCD" },
            { value: "CMND", label: "CMND" },
            { value: "Passport", label: "Passport" },
            { value: "Other", label: "Other" },
          ]}
        />
        <Input
          id="idNumber"
          label="ID Number"
          name="idNumber"
          defaultValue={tenant?.idNumber}
          placeholder="ID number"
        />
      </div>

      <div className="mt-4">
        <Textarea
          id="notes"
          label="Notes"
          name="notes"
          defaultValue={tenant?.notes}
          placeholder="Any notes about this tenant..."
        />
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : tenant ? "Save Changes" : "Add Tenant"}
        </Button>
      </div>
    </Form>
  );
}
