import { test, expect } from "@playwright/test";

// Login tests run WITHOUT stored auth state
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Login", () => {
  test("should redirect to login page when not authenticated", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "NhaTro" })
    ).toBeVisible();
  });

  test("should show error with invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Tên đăng nhập").fill("admin");
    await page.getByLabel("Mật khẩu").fill("wrongpassword");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page.getByText("Tên đăng nhập hoặc mật khẩu không đúng")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("should login with valid credentials and redirect to dashboard", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel("Tên đăng nhập").fill("admin");
    await page.getByLabel("Mật khẩu").fill("admin123");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.locator("h1")).toHaveText("Bảng điều khiển");
  });

  test("should logout and redirect to login", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Tên đăng nhập").fill("admin");
    await page.getByLabel("Mật khẩu").fill("admin123");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page).toHaveURL("/");

    // Click logout (Vietnamese default)
    await page.getByRole("button", { name: "Đăng xuất" }).click();

    await expect(page).toHaveURL(/\/login/);
  });
});
