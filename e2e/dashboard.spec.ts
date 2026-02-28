import { test, expect } from "@playwright/test";
import { resetDatabase } from "./helpers/setup";

test.beforeAll(() => {
  resetDatabase();
});

test.describe("Dashboard", () => {
  test("should display stats with 10 rooms all vacant", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1")).toHaveText("Dashboard");
    await expect(page.getByText("Total Rooms")).toBeVisible();

    const statValues = page.locator(".text-3xl");
    await expect(statValues.first()).toHaveText("10");
  });

  test("should display room overview grid with 10 rooms", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Room Overview")).toBeVisible();

    for (let i = 1; i <= 10; i++) {
      await expect(
        page.getByText(`Room ${i}`, { exact: true })
      ).toBeVisible();
    }
  });

  test("should navigate to other pages via sidebar", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Rooms" }).click();
    await expect(page).toHaveURL("/rooms");

    await page.getByRole("link", { name: "Tenants" }).click();
    await expect(page).toHaveURL("/tenants");

    await page.getByRole("link", { name: "Contracts" }).click();
    await expect(page).toHaveURL("/contracts");

    await page.getByRole("link", { name: "Payments" }).click();
    await expect(page).toHaveURL("/payments");

    await page.getByRole("link", { name: "Utilities" }).click();
    await expect(page).toHaveURL("/utilities");

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL("/settings");
  });
});
