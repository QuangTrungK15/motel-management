import { test, expect } from "@playwright/test";
import { resetDatabase } from "./helpers/setup";

test.beforeAll(() => {
  resetDatabase();
});

test.describe("Tenants", () => {
  test("should show add tenant button", async ({ page }) => {
    await page.goto("/tenants");

    await expect(page.locator("h1")).toHaveText("Tenants");
    await expect(
      page.getByRole("button", { name: "+ Add Tenant" })
    ).toBeVisible();
  });

  test("should add a new tenant", async ({ page }) => {
    await page.goto("/tenants");

    await page.getByRole("button", { name: "+ Add Tenant" }).click();

    await page.getByLabel("First Name").fill("Nguyen");
    await page.getByLabel("Last Name").fill("Van A");
    await page.getByLabel("Phone").fill("0901234567");
    await page.getByLabel("Email").fill("nguyenvana@test.com");
    await page.getByLabel("ID Type").selectOption("CCCD");
    await page.getByLabel("ID Number").fill("001234567890");

    await page
      .getByRole("button", { name: "Add Tenant", exact: true })
      .click();

    await expect(page.getByText("Nguyen Van A").first()).toBeVisible();
    await expect(page.getByText("0901234567").first()).toBeVisible();
  });

  test("should add a second tenant", async ({ page }) => {
    await page.goto("/tenants");

    await page.getByRole("button", { name: "+ Add Tenant" }).click();

    await page.getByLabel("First Name").fill("Tran");
    await page.getByLabel("Last Name").fill("Thi B");
    await page.getByLabel("Phone").fill("0912345678");

    await page
      .getByRole("button", { name: "Add Tenant", exact: true })
      .click();

    await expect(page.getByText("Tran Thi B").first()).toBeVisible();
  });

  test("should edit a tenant", async ({ page }) => {
    await page.goto("/tenants");

    // Use first Edit button in the Nguyen row
    const firstRow = page.getByRole("row").filter({ hasText: "Nguyen Van A" }).first();
    await firstRow.getByRole("button", { name: "Edit" }).click();

    await page.getByLabel("Phone").clear();
    await page.getByLabel("Phone").fill("0999999999");

    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.getByText("0999999999").first()).toBeVisible();
  });

  test("should search tenants by name", async ({ page }) => {
    await page.goto("/tenants");

    await expect(page.getByText("Nguyen Van A").first()).toBeVisible();
    await expect(page.getByText("Tran Thi B").first()).toBeVisible();

    await page
      .getByPlaceholder("Search by name, phone, or ID...")
      .fill("Nguyen");

    await page.waitForURL(/search=Nguyen/);

    await expect(page.getByText("Nguyen Van A").first()).toBeVisible();
    await expect(page.getByText("Tran Thi B")).not.toBeVisible();
  });

  test("should delete a tenant without active contracts", async ({ page }) => {
    await page.goto("/tenants");

    const row = page.getByRole("row").filter({ hasText: "Tran Thi B" }).first();
    await row.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("Delete Tenant")).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();

    await expect(page.getByText("Tran Thi B")).not.toBeVisible();
  });

  test("should reject duplicate ID number when creating tenant", async ({
    page,
  }) => {
    await page.goto("/tenants");

    await page.getByRole("button", { name: "+ Add Tenant" }).click();

    const modal = page.locator(".fixed.inset-0");
    await modal.getByLabel("First Name").fill("Pham");
    await modal.getByLabel("Last Name").fill("Van X");
    await modal.getByLabel("ID Type").selectOption("CCCD");
    await modal.getByLabel("ID Number").fill("001234567890"); // same as Nguyen Van A

    await modal
      .getByRole("button", { name: "Add Tenant", exact: true })
      .click();

    // Error should appear in modal — modal stays open
    await expect(modal.getByText(/already used/)).toBeVisible();
    await expect(modal.getByText("Add New Tenant")).toBeVisible();
  });

  test("setup: create second tenant with ID for edit test", async ({
    page,
  }) => {
    await page.goto("/tenants");

    await page.getByRole("button", { name: "+ Add Tenant" }).click();

    const modal = page.locator(".fixed.inset-0");
    await modal.getByLabel("First Name").fill("Tran");
    await modal.getByLabel("Last Name").fill("Thi B");
    await modal.getByLabel("ID Type").selectOption("CMND");
    await modal.getByLabel("ID Number").fill("999000111222");
    await modal
      .getByRole("button", { name: "Add Tenant", exact: true })
      .click();

    await expect(page.getByText("Tran Thi B").first()).toBeVisible();
  });

  test("should reject duplicate ID number when editing tenant", async ({
    page,
  }) => {
    await page.goto("/tenants");

    // Edit Tran Thi B to use Nguyen Van A's ID
    const row = page
      .getByRole("row")
      .filter({ hasText: "Tran Thi B" })
      .first();
    await row.getByRole("button", { name: "Edit" }).click();

    const modal = page.locator(".fixed.inset-0");
    await modal.getByLabel("ID Type").selectOption("CCCD");
    await modal.getByLabel("ID Number").clear();
    await modal.getByLabel("ID Number").fill("001234567890");

    await modal.getByRole("button", { name: "Save Changes" }).click();

    // Error should appear in modal — modal stays open
    await expect(modal.getByText(/already used/)).toBeVisible();
    await expect(modal.getByText("Edit Tenant")).toBeVisible();
  });
});
