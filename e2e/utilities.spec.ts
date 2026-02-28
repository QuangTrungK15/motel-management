import { test, expect } from "@playwright/test";
import { resetDatabase } from "./helpers/setup";

test.beforeAll(() => {
  resetDatabase();
});

test.describe("Utilities", () => {
  test("should show utilities page with stats", async ({ page }) => {
    await page.goto("/utilities");

    await expect(page.locator("h1")).toHaveText("Utilities");
    await expect(page.getByText("Total Electric")).toBeVisible();
    await expect(page.getByText("Total Water")).toBeVisible();
    await expect(page.getByText("Total Utilities")).toBeVisible();
  });

  test("should show all 10 rooms in utility table", async ({ page }) => {
    await page.goto("/utilities");

    for (let i = 1; i <= 10; i++) {
      await expect(
        page.getByText(`Room ${i}`, { exact: true })
      ).toBeVisible();
    }
  });

  test("should generate utility records for all rooms", async ({ page }) => {
    await page.goto("/utilities");

    await page.getByRole("button", { name: "Generate All Rooms" }).click();

    const editButtons = page.getByRole("button", {
      name: "Edit",
      exact: true,
    });
    await expect(editButtons).toHaveCount(10);
  });

  test("should enter utility readings for a room", async ({ page }) => {
    await page.goto("/utilities");

    // Use nth to get Room 1 (first data row, index 1 after header)
    const rows = page.locator("table tbody tr");
    const room1Row = rows.nth(0);
    await room1Row.getByRole("button", { name: "Edit" }).click();

    const modal = page.locator(".fixed.inset-0");
    await modal.getByLabel("Start Reading (kWh)").clear();
    await modal.getByLabel("Start Reading (kWh)").fill("100");
    await modal.getByLabel("End Reading (kWh)").clear();
    await modal.getByLabel("End Reading (kWh)").fill("150");

    await modal.getByLabel("Start Reading (m³)").clear();
    await modal.getByLabel("Start Reading (m³)").fill("10");
    await modal.getByLabel("End Reading (m³)").clear();
    await modal.getByLabel("End Reading (m³)").fill("15");

    await modal.getByRole("button", { name: "Save" }).click();

    // Verify readings appear in first row
    const updatedRow = rows.nth(0);
    await expect(updatedRow.getByText("100 → 150")).toBeVisible();
    await expect(updatedRow.getByText("10 → 15")).toBeVisible();
  });

  test("should calculate utility costs correctly", async ({ page }) => {
    await page.goto("/utilities");

    // Room 1 (first row): 50 kWh usage, 5 m³ usage
    const rows = page.locator("table tbody tr");
    const room1Row = rows.nth(0);
    await expect(room1Row.getByText("(50)")).toBeVisible();
    await expect(room1Row.getByText("(5)")).toBeVisible();
  });

  test("should switch between months", async ({ page }) => {
    await page.goto("/utilities");

    const monthSelect = page.locator("select").first();
    await monthSelect.selectOption({ index: 0 });

    await expect(page.getByText("Utility Readings")).toBeVisible();
  });
});
