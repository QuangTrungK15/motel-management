import { useState } from "react";
import { Form, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/payments";
import { prisma } from "~/lib/db.server";
import { PageContainer } from "~/components/layout/page-container";
import { Header } from "~/components/layout/header";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
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
  return [{ title: "Payments - Motel Manager" }];
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
  const url = new URL(request.url);
  const month = url.searchParams.get("month") || getCurrentMonth();

  const activeContracts = await prisma.contract.findMany({
    where: { status: "active" },
    include: {
      room: true,
      tenant: true,
      payments: {
        where: { month },
      },
    },
    orderBy: { room: { number: "asc" } },
  });

  // Build rent status per room for this month
  const rentStatus = activeContracts.map((contract) => {
    const rentPayment = contract.payments.find((p) => p.type === "rent");
    return {
      contractId: contract.id,
      roomNumber: contract.room.number,
      tenantName: `${contract.tenant.firstName} ${contract.tenant.lastName}`,
      monthlyRent: contract.monthlyRent,
      paid: rentPayment?.status === "paid",
      paymentId: rentPayment?.id || null,
      paidAmount: rentPayment?.amount || 0,
    };
  });

  // All payments for this month
  const allPayments = await prisma.payment.findMany({
    where: { month },
    include: {
      contract: {
        include: { room: true, tenant: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalExpected = rentStatus.reduce((s, r) => s + r.monthlyRent, 0);
  const totalPaid = allPayments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const totalPending = totalExpected - rentStatus.filter((r) => r.paid).reduce((s, r) => s + r.monthlyRent, 0);

  return {
    month,
    rentStatus,
    allPayments,
    activeContracts,
    stats: { totalExpected, totalPaid, totalPending },
    monthOptions: getMonthOptions(),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "generate-rent") {
    const month = formData.get("month") as string;

    const activeContracts = await prisma.contract.findMany({
      where: { status: "active" },
    });

    for (const contract of activeContracts) {
      const existing = await prisma.payment.findFirst({
        where: { contractId: contract.id, month, type: "rent" },
      });
      if (!existing) {
        await prisma.payment.create({
          data: {
            contractId: contract.id,
            amount: contract.monthlyRent,
            month,
            type: "rent",
            method: "cash",
            status: "pending",
          },
        });
      }
    }
  }

  if (intent === "mark-paid") {
    const paymentId = Number(formData.get("paymentId"));
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: "paid", paidAt: new Date() },
    });
  }

  if (intent === "mark-unpaid") {
    const paymentId = Number(formData.get("paymentId"));
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: "pending", paidAt: null },
    });
  }

  if (intent === "add-payment") {
    const contractId = Number(formData.get("contractId"));
    const amount = Number(formData.get("amount"));
    const month = formData.get("month") as string;
    const type = formData.get("type") as string;
    const method = formData.get("method") as string;
    const status = formData.get("status") as string;
    const notes = (formData.get("notes") as string) || "";

    await prisma.payment.create({
      data: {
        contractId,
        amount,
        month,
        type,
        method,
        status,
        paidAt: status === "paid" ? new Date() : null,
        notes,
      },
    });
  }

  if (intent === "delete-payment") {
    const paymentId = Number(formData.get("paymentId"));
    await prisma.payment.delete({ where: { id: paymentId } });
  }

  return { ok: true };
}

export default function Payments({ loaderData }: Route.ComponentProps) {
  const { month, rentStatus, allPayments, activeContracts, stats, monthOptions } =
    loaderData;
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSubmitting = navigation.state === "submitting";

  const [showAddPayment, setShowAddPayment] = useState(false);

  return (
    <PageContainer>
      <Header
        title="Payments"
        description="Track rent payments and other charges"
        actions={
          <div className="flex gap-3">
            <Form method="post">
              <input type="hidden" name="intent" value="generate-rent" />
              <input type="hidden" name="month" value={month} />
              <Button variant="secondary" type="submit" disabled={isSubmitting}>
                Generate Rent
              </Button>
            </Form>
            <Button onClick={() => setShowAddPayment(true)}>+ Add Payment</Button>
          </div>
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
        <Stat label="Expected" value={formatCurrency(stats.totalExpected)} />
        <Stat label="Collected" value={formatCurrency(stats.totalPaid)} />
        <Stat label="Pending" value={formatCurrency(stats.totalPending)} />
      </div>

      {/* Rent Status per Room */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Rent Status — {formatMonth(month)}</CardTitle>
        </CardHeader>

        {rentStatus.length === 0 ? (
          <p className="text-sm text-gray-400">
            No active contracts. Click "Generate Rent" to create rent records for this month.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rentStatus.map((row) => (
                <TableRow key={row.contractId}>
                  <TableCell>
                    <Badge variant="info">Room {row.roomNumber}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{row.tenantName}</TableCell>
                  <TableCell>{formatCurrency(row.monthlyRent)}</TableCell>
                  <TableCell>
                    {row.paymentId ? (
                      <Badge variant={row.paid ? "success" : "warning"}>
                        {row.paid ? "Paid" : "Pending"}
                      </Badge>
                    ) : (
                      <Badge variant="default">Not generated</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.paymentId && !row.paid && (
                      <Form method="post" className="inline">
                        <input type="hidden" name="intent" value="mark-paid" />
                        <input type="hidden" name="paymentId" value={row.paymentId} />
                        <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                          Mark Paid
                        </Button>
                      </Form>
                    )}
                    {row.paymentId && row.paid && (
                      <Form method="post" className="inline">
                        <input type="hidden" name="intent" value="mark-unpaid" />
                        <input type="hidden" name="paymentId" value={row.paymentId} />
                        <Button variant="ghost" size="sm" type="submit" disabled={isSubmitting}>
                          Undo
                        </Button>
                      </Form>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* All Payments this Month */}
      <Card>
        <CardHeader>
          <CardTitle>All Payments — {formatMonth(month)}</CardTitle>
        </CardHeader>

        {allPayments.length === 0 ? (
          <p className="text-sm text-gray-400">No payments recorded for this month.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>Room {payment.contract.room.number}</TableCell>
                  <TableCell>
                    {payment.contract.tenant.firstName} {payment.contract.tenant.lastName}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        payment.type === "rent"
                          ? "info"
                          : payment.type === "deposit"
                          ? "default"
                          : payment.type === "utility"
                          ? "warning"
                          : "default"
                      }
                    >
                      {payment.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(payment.amount)}
                  </TableCell>
                  <TableCell>{payment.method}</TableCell>
                  <TableCell>
                    <Badge variant={payment.status === "paid" ? "success" : "warning"}>
                      {payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Form method="post" className="inline">
                      <input type="hidden" name="intent" value="delete-payment" />
                      <input type="hidden" name="paymentId" value={payment.id} />
                      <Button
                        variant="ghost"
                        size="sm"
                        type="submit"
                        className="text-red-600 hover:text-red-700"
                        disabled={isSubmitting}
                      >
                        Delete
                      </Button>
                    </Form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Add Payment Modal */}
      <Modal
        open={showAddPayment}
        onClose={() => setShowAddPayment(false)}
        title="Add Payment"
        size="lg"
      >
        <Form method="post" onSubmit={() => setShowAddPayment(false)}>
          <input type="hidden" name="intent" value="add-payment" />

          <div className="space-y-4">
            <Select
              id="contractId"
              label="Contract (Room — Tenant)"
              name="contractId"
              required
              options={[
                { value: "", label: "Select..." },
                ...activeContracts.map((c) => ({
                  value: String(c.id),
                  label: `Room ${c.room.number} — ${c.tenant.firstName} ${c.tenant.lastName}`,
                })),
              ]}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                id="amount"
                label="Amount"
                name="amount"
                type="number"
                required
                placeholder="0"
              />
              <Input
                id="paymentMonth"
                label="Month"
                name="month"
                defaultValue={month}
                placeholder="YYYY-MM"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Select
                id="type"
                label="Type"
                name="type"
                options={[
                  { value: "rent", label: "Rent" },
                  { value: "deposit", label: "Deposit" },
                  { value: "utility", label: "Utility" },
                  { value: "other", label: "Other" },
                ]}
              />
              <Select
                id="method"
                label="Method"
                name="method"
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "transfer", label: "Transfer" },
                  { value: "card", label: "Card" },
                ]}
              />
              <Select
                id="status"
                label="Status"
                name="status"
                options={[
                  { value: "paid", label: "Paid" },
                  { value: "pending", label: "Pending" },
                ]}
              />
            </div>

            <Textarea
              id="notes"
              label="Notes"
              name="notes"
              placeholder="Optional notes..."
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddPayment(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Add Payment"}
            </Button>
          </div>
        </Form>
      </Modal>
    </PageContainer>
  );
}
