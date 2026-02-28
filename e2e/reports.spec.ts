import { test, expect } from "@playwright/test";
import { resetDatabase } from "./helpers/setup";

test.beforeAll(() => {
  resetDatabase();
});

test.describe("Reports", () => {
  test("should show reports page with stats", async ({ page }) => {
    await page.goto("/reports");

    await expect(page.locator("h1")).toHaveText("Reports");
    await expect(page.getByText("Total Income")).toBeVisible();
    await expect(page.getByText("Occupancy Rate")).toBeVisible();
    await expect(page.getByText("Occupancy History (6 months)")).toBeVisible();
  });

  test("setup: create two tenants for occupancy test", async ({ page }) => {
    await page.goto("/tenants");

    // Tenant A
    await page.getByRole("button", { name: "+ Add Tenant" }).click();
    await page.getByLabel("First Name").fill("Tenant");
    await page.getByLabel("Last Name").fill("A");
    await page
      .getByRole("button", { name: "Add Tenant", exact: true })
      .click();
    await expect(page.getByText("Tenant A").first()).toBeVisible();

    // Tenant B
    await page.getByRole("button", { name: "+ Add Tenant" }).click();
    await page.getByLabel("First Name").fill("Tenant");
    await page.getByLabel("Last Name").fill("B");
    await page
      .getByRole("button", { name: "Add Tenant", exact: true })
      .click();
    await expect(page.getByText("Tenant B").first()).toBeVisible();
  });

  test("setup: move in tenant A then move out", async ({ page }) => {
    await page.goto("/contracts");

    // Move in tenant A
    await page.getByRole("button", { name: "+ Move In" }).click();
    const modal = page.locator(".fixed.inset-0");
    await modal.getByLabel("Room").selectOption({ index: 1 });
    await modal.getByLabel("Main Tenant").selectOption("Tenant A");
    await modal.getByRole("button", { name: "Move In" }).click();
    await expect(page.getByText("Active Contracts (1)")).toBeVisible();

    // Move out tenant A
    const activeTable = page.locator("table").first();
    await activeTable.getByRole("button", { name: "Move Out" }).click();
    const dialog = page.locator(".fixed.inset-0");
    await dialog.getByRole("button", { name: "Move Out" }).click();
    await expect(page.getByText("Active Contracts (0)")).toBeVisible();
  });

  test("setup: move in tenant B to same room", async ({ page }) => {
    await page.goto("/contracts");

    await page.getByRole("button", { name: "+ Move In" }).click();
    const modal = page.locator(".fixed.inset-0");
    await modal.getByLabel("Room").selectOption({ index: 1 });
    await modal.getByLabel("Main Tenant").selectOption("Tenant B");
    await modal.getByRole("button", { name: "Move In" }).click();
    await expect(page.getByText("Active Contracts (1)")).toBeVisible();
  });

  test("should count room only once in occupancy history after turnover", async ({
    page,
  }) => {
    await page.goto("/reports");

    // Room 1 had 2 contracts this month (A moved out, B moved in)
    // but occupancy history should show 1/10, not 2/10
    const currentMonthBar = page.getByText("1/10").first();
    await expect(currentMonthBar).toBeVisible();

    // Should NOT show 2/10 anywhere
    await expect(page.getByText("2/10")).not.toBeVisible();
  });
});
