import { test as setup, expect } from "@playwright/test";
import { resetDatabase } from "./helpers/setup";

setup("authenticate", async ({ page }) => {
  resetDatabase();

  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("admin");
  await page.getByLabel("Mật khẩu").fill("admin123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("/");

  // Set language to English for all authenticated tests
  await page.evaluate(() => localStorage.setItem("language", "en"));
  await page.context().storageState({ path: "e2e/.auth/session.json" });
});
