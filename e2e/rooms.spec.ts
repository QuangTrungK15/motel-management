import { test, expect } from "@playwright/test";
import { resetDatabase } from "./helpers/setup";

test.beforeAll(() => {
  resetDatabase();
});

test.describe("Rooms", () => {
  test("should display all 10 rooms with status badges", async ({ page }) => {
    await page.goto("/rooms");

    await expect(page.locator("h1")).toHaveText("Rooms");

    await expect(page.getByText(/Vacant: \d+/)).toBeVisible();
    await expect(page.getByText(/Occupied: \d+/)).toBeVisible();
    await expect(page.getByText(/Maintenance: \d+/)).toBeVisible();

    for (let i = 1; i <= 10; i++) {
      await expect(page.getByText(`#${i}`, { exact: true })).toBeVisible();
    }
  });

  test("should open room detail modal when clicking a room card", async ({
    page,
  }) => {
    await page.goto("/rooms");

    await page.getByText("#1", { exact: true }).click();

    // Scope assertions to the modal
    const modal = page.locator(".fixed.inset-0");
    await expect(modal).toBeVisible();
    await expect(modal.getByText("Room #1")).toBeVisible();
    await expect(modal.getByRole("button", { name: "Edit Room" })).toBeVisible();
  });

  test("should close detail modal with Close button", async ({ page }) => {
    await page.goto("/rooms");

    await page.getByText("#1", { exact: true }).click();
    const modal = page.locator(".fixed.inset-0");
    await expect(modal).toBeVisible();

    await modal.getByRole("button", { name: "Close" }).click();
    await expect(modal).not.toBeVisible();
  });

  test("should switch to edit mode and save changes", async ({ page }) => {
    await page.goto("/rooms");

    await page.getByText("#1", { exact: true }).click();
    const modal = page.locator(".fixed.inset-0");
    await modal.getByRole("button", { name: "Edit Room" }).click();

    await expect(modal.getByLabel("Monthly Rate")).toBeVisible();
    await modal.getByLabel("Notes").fill("Test note for room 1");
    await modal.getByRole("button", { name: "Save Changes" }).click();

    // Reopen and verify
    await page.getByText("#1", { exact: true }).click();
    await expect(
      modal.getByText("Test note for room 1").first()
    ).toBeVisible();
  });

  test("should edit room status to maintenance", async ({ page }) => {
    await page.goto("/rooms");

    await page.getByText("#2", { exact: true }).click();
    const modal = page.locator(".fixed.inset-0");
    await modal.getByRole("button", { name: "Edit Room" }).click();

    await modal.getByLabel("Status").selectOption("maintenance");
    await modal.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.getByText(/Maintenance: 1/)).toBeVisible();
  });

  test("should update all room rates when default rate is changed in settings", async ({
    page,
  }) => {
    // Change default room rate in settings
    await page.goto("/settings");
    await page.getByLabel("Default Room Rate (per month)").clear();
    await page.getByLabel("Default Room Rate (per month)").fill("4500000");
    await page.getByRole("button", { name: "Save Rates" }).click();
    await expect(page.getByText("Settings saved successfully")).toBeVisible();

    // Verify rooms show updated rate
    await page.goto("/rooms");
    await page.getByText("#3", { exact: true }).click();

    const modal = page.locator(".fixed.inset-0");
    await expect(modal.getByText("4.500.000")).toBeVisible();
  });
});
