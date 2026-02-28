import { test, expect } from "@playwright/test";
import { resetDatabase } from "./helpers/setup";

test.beforeAll(() => {
  resetDatabase();
});

test.describe("Contracts", () => {
  test("setup: create a tenant for contract tests", async ({ page }) => {
    await page.goto("/tenants");

    await page.getByRole("button", { name: "+ Add Tenant" }).click();
    await page.getByLabel("First Name").fill("Le");
    await page.getByLabel("Last Name").fill("Van C");
    await page.getByLabel("Phone").fill("0923456789");
    await page
      .getByRole("button", { name: "Add Tenant", exact: true })
      .click();

    await expect(page.getByText("Le Van C").first()).toBeVisible();
  });

  test("should show contracts page with no active contracts", async ({
    page,
  }) => {
    await page.goto("/contracts");

    await expect(page.locator("h1")).toHaveText("Contracts");
    await expect(
      page.getByText("Active Contracts (0)")
    ).toBeVisible();
  });

  test("should move in a tenant with occupants", async ({ page }) => {
    await page.goto("/contracts");

    await page.getByRole("button", { name: "+ Move In" }).click();

    const modal = page.locator(".fixed.inset-0");
    await modal.getByLabel("Room").selectOption({ index: 1 });
    await modal.getByLabel("Main Tenant").selectOption({ index: 1 });
    await modal.getByLabel("Monthly Rent").clear();
    await modal.getByLabel("Monthly Rent").fill("3500000");
    await modal.getByLabel("Deposit").clear();
    await modal.getByLabel("Deposit").fill("3500000");

    // Add first occupant
    await modal.getByRole("button", { name: "+ Add Person" }).click();
    await modal.locator("#occupant_0_firstName").fill("Nguyen");
    await modal.locator("#occupant_0_lastName").fill("Thi D");
    await modal.locator("#occupant_0_phone").fill("0912345678");
    await modal.locator("select[name='occupant_0_relationship']").selectOption("spouse");

    // Add second occupant
    await modal.getByRole("button", { name: "+ Add Person" }).click();
    await modal.locator("#occupant_1_firstName").fill("Le");
    await modal.locator("#occupant_1_lastName").fill("Van E");
    await modal.locator("select[name='occupant_1_relationship']").selectOption("family");

    const moveInBtn = modal.getByRole("button", { name: "Move In" });
    await moveInBtn.scrollIntoViewIfNeeded();
    await moveInBtn.click();

    // Verify contract created
    await expect(page.getByText("Active Contracts (1)")).toBeVisible();
    await expect(page.getByText("Le Van C").first()).toBeVisible();
  });

  test("should show people count in active contracts table", async ({
    page,
  }) => {
    await page.goto("/contracts");

    // 1 tenant + 2 occupants = 3/5
    await expect(page.getByText("3/5")).toBeVisible();
  });

  test("should show room as occupied on rooms page", async ({ page }) => {
    await page.goto("/rooms");

    await expect(page.getByText(/Occupied: 1/)).toBeVisible();
  });

  test("should show tenant and people count on dashboard", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Le Van C").first()).toBeVisible();
    await expect(page.getByText("3/5 people").first()).toBeVisible();
  });

  test("should show occupants in room detail modal", async ({ page }) => {
    await page.goto("/rooms");

    // Click the first occupied room card
    await page.getByText("#1", { exact: true }).click();

    const modal = page.locator(".fixed.inset-0");
    await expect(modal).toBeVisible();

    // Verify people count badge
    await expect(modal.getByText("3/5 people")).toBeVisible();

    // Verify occupant names
    await expect(modal.getByText("Nguyen Thi D").first()).toBeVisible();
    await expect(modal.getByText("Le Van E").first()).toBeVisible();

    // Verify occupant section header
    await expect(modal.getByText("Occupants (2)")).toBeVisible();

    await modal.getByRole("button", { name: "Close" }).click();
  });

  test("should move out a tenant and occupants", async ({ page }) => {
    await page.goto("/contracts");

    // Click Move Out in the active contracts table
    const activeTable = page.locator("table").first();
    await activeTable.getByRole("button", { name: "Move Out" }).click();

    // Confirm dialog should mention occupants
    await expect(page.getByText("Confirm Move Out")).toBeVisible();
    await expect(page.getByText(/2 occupants/)).toBeVisible();

    const dialog = page.locator(".fixed.inset-0");
    await dialog.getByRole("button", { name: "Move Out" }).click();

    // Verify
    await expect(page.getByText("Active Contracts (0)")).toBeVisible();
    await expect(page.getByText("Past Contracts")).toBeVisible();
  });

  test("should show room as vacant again after move out", async ({ page }) => {
    await page.goto("/rooms");

    await expect(page.getByText(/Occupied: 0/)).toBeVisible();
  });

  test("setup: create tenant with ID for uniqueness tests", async ({
    page,
  }) => {
    await page.goto("/tenants");

    await page.getByRole("button", { name: "+ Add Tenant" }).click();
    await page.getByLabel("First Name").fill("Test");
    await page.getByLabel("Last Name").fill("Person");
    await page.getByLabel("ID Type").selectOption("CCCD");
    await page.getByLabel("ID Number").fill("112233445566");
    await page
      .getByRole("button", { name: "Add Tenant", exact: true })
      .click();

    await expect(page.getByText("Test Person").first()).toBeVisible();
  });

  test("should reject occupant ID matching existing tenant", async ({
    page,
  }) => {
    await page.goto("/contracts");

    await page.getByRole("button", { name: "+ Move In" }).click();

    const modal = page.locator(".fixed.inset-0");
    await modal.getByLabel("Room").selectOption({ index: 1 });
    await modal.getByLabel("Main Tenant").selectOption({ index: 1 });

    // Add occupant with same ID as Test Person tenant
    await modal.getByRole("button", { name: "+ Add Person" }).click();
    await modal.locator("#occupant_0_firstName").fill("Duplicate");
    await modal.locator("#occupant_0_lastName").fill("ID");
    await modal
      .locator("select[name='occupant_0_idType']")
      .selectOption("CCCD");
    await modal.locator("#occupant_0_idNumber").fill("112233445566");

    const moveInBtn = modal.getByRole("button", { name: "Move In" });
    await moveInBtn.scrollIntoViewIfNeeded();
    await moveInBtn.click();

    // Error should appear inside modal
    await expect(modal.getByText(/already used by Test Person/)).toBeVisible();
  });

  test("should reject duplicate occupant IDs in same form", async ({
    page,
  }) => {
    await page.goto("/contracts");

    await page.getByRole("button", { name: "+ Move In" }).click();

    const modal = page.locator(".fixed.inset-0");
    await modal.getByLabel("Room").selectOption({ index: 1 });
    await modal.getByLabel("Main Tenant").selectOption({ index: 1 });

    // Add two occupants with the same ID number
    await modal.getByRole("button", { name: "+ Add Person" }).click();
    await modal.locator("#occupant_0_firstName").fill("Person");
    await modal.locator("#occupant_0_lastName").fill("One");
    await modal
      .locator("select[name='occupant_0_idType']")
      .selectOption("CCCD");
    await modal.locator("#occupant_0_idNumber").fill("999888777666");

    await modal.getByRole("button", { name: "+ Add Person" }).click();
    await modal.locator("#occupant_1_firstName").fill("Person");
    await modal.locator("#occupant_1_lastName").fill("Two");
    await modal
      .locator("select[name='occupant_1_idType']")
      .selectOption("CCCD");
    await modal.locator("#occupant_1_idNumber").fill("999888777666");

    const moveInBtn = modal.getByRole("button", { name: "Move In" });
    await moveInBtn.scrollIntoViewIfNeeded();
    await moveInBtn.click();

    // Should show duplicate error inside modal
    await expect(modal.getByText(/Duplicate ID numbers/)).toBeVisible();
  });
});
