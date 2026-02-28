import { test as setup, expect } from "@playwright/test";
import { resetDatabase } from "./helpers/setup";

setup("authenticate", async ({ page }) => {
  resetDatabase();

  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("/");

  await page.context().storageState({ path: "e2e/.auth/session.json" });
});
