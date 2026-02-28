import { test, expect } from "@playwright/test";
import { resetDatabase } from "./helpers/setup";

test.beforeAll(() => {
  resetDatabase();
});

test.describe("Payments", () => {
  test("setup: create tenant and contract", async ({ page }) => {
    // Create tenant
    await page.goto("/tenants");
    await page.getByRole("button", { name: "+ Add Tenant" }).click();
    await page.getByLabel("First Name").fill("Pham");
    await page.getByLabel("Last Name").fill("Van D");
    await page
      .getByRole("button", { name: "Add Tenant", exact: true })
      .click();
    await expect(page.getByText("Pham Van D").first()).toBeVisible();

    // Move in
    await page.goto("/contracts");
    await page.getByRole("button", { name: "+ Move In" }).click();

    const modal = page.locator(".fixed.inset-0");
    await modal.getByLabel("Room").selectOption({ index: 1 });
    await modal.getByLabel("Tenant").selectOption({ index: 1 });
    await modal.getByLabel("Monthly Rent").clear();
    await modal.getByLabel("Monthly Rent").fill("3000000");
    await modal.getByRole("button", { name: "Move In" }).click();

    // Verify contract was created
    await expect(page.getByText("Active Contracts (1)")).toBeVisible();
  });

  test("should show payments page with stats", async ({ page }) => {
    await page.goto("/payments");

    await expect(page.locator("h1")).toHaveText("Payments");
    await expect(page.getByText("Expected")).toBeVisible();
    await expect(page.getByText("Collected")).toBeVisible();
    await expect(page.getByText("Pending")).toBeVisible();
  });

  test("should generate rent for current month", async ({ page }) => {
    await page.goto("/payments");

    await page.getByRole("button", { name: "Generate Rent" }).click();

    await expect(page.getByText("Pham Van D").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Mark Paid" })
    ).toBeVisible();
  });

  test("should mark rent as paid", async ({ page }) => {
    await page.goto("/payments");

    await page.getByRole("button", { name: "Mark Paid" }).click();

    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  });

  test("should undo payment (mark as unpaid)", async ({ page }) => {
    await page.goto("/payments");

    await page.getByRole("button", { name: "Undo" }).click();

    await expect(
      page.getByRole("button", { name: "Mark Paid" })
    ).toBeVisible();
  });

  test("should add a manual payment", async ({ page }) => {
    await page.goto("/payments");

    await page.getByRole("button", { name: "+ Add Payment" }).click();

    const modal = page.locator(".fixed.inset-0");
    await modal.getByLabel("Contract (Room").selectOption({ index: 1 });
    await modal.getByLabel("Amount").fill("500000");
    await modal.getByLabel("Type").selectOption("other");
    await modal.getByLabel("Method").selectOption("transfer");
    await modal.getByLabel("Status").selectOption("paid");

    await modal.getByRole("button", { name: "Add Payment" }).click();

    await expect(
      page.locator("table").last().getByText("other")
    ).toBeVisible();
  });

  test("should delete a payment", async ({ page }) => {
    await page.goto("/payments");

    const allPaymentsTable = page.locator("table").last();
    const otherRow = allPaymentsTable
      .getByRole("row")
      .filter({ hasText: "other" });
    await otherRow.getByRole("button", { name: "Delete" }).click();

    await expect(
      allPaymentsTable.getByRole("row").filter({ hasText: "other" })
    ).not.toBeVisible();
  });
});
