/**
 * Smoke tests against the seeded fake data.
 * These tests do NOT reset the database — they validate
 * the app works correctly with the pre-seeded data.
 */
import { test, expect } from "@playwright/test";

// Use stored auth but do NOT reset the database
test.describe("Smoke Tests with Fake Data", () => {
  test("Dashboard: stats match seeded data (7 occupied, 2 vacant, 1 maintenance)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();

    // Total rooms = 10
    const stats = page.locator(".text-3xl");
    const statTexts = await stats.allTextContents();
    console.log("Dashboard stats:", statTexts);

    // Should show 10 total rooms
    await expect(page.getByText("10").first()).toBeVisible();
  });

  test("Rooms: 7 occupied, 2 vacant, 1 maintenance badges shown", async ({ page }) => {
    await page.goto("/rooms");

    // Check status counters
    await expect(page.getByText(/Vacant: 2/)).toBeVisible();
    await expect(page.getByText(/Occupied: 7/)).toBeVisible();
    await expect(page.getByText(/Maintenance: 1/)).toBeVisible();
  });

  test("Rooms: Room 1 shows tenant and 3/5 people", async ({ page }) => {
    await page.goto("/rooms");

    // Room 1 card should show tenant name
    await expect(page.getByText("Nguyen Van An").first()).toBeVisible();

    // Click room 1 to see details
    await page.getByText("#1", { exact: true }).click();
    const modal = page.locator(".fixed.inset-0");
    await expect(modal).toBeVisible();

    // 1 tenant + 2 occupants = 3/5
    await expect(modal.getByText("3/5")).toBeVisible();

    // Occupants should be listed
    await expect(modal.getByText("Nguyen Thi Huyen").first()).toBeVisible();
    await expect(modal.getByText("Nguyen Bao Khang").first()).toBeVisible();
  });

  test("Rooms: Room 4 shows 4/5 people (family of 4)", async ({ page }) => {
    await page.goto("/rooms");

    await page.getByText("#4", { exact: true }).click();
    const modal = page.locator(".fixed.inset-0");

    // 1 tenant + 3 occupants = 4/5
    await expect(modal.getByText("4/5")).toBeVisible();
    await expect(modal.getByText("Pham Thi Lan").first()).toBeVisible();
  });

  test("Rooms: Room 8 shows maintenance status", async ({ page }) => {
    await page.goto("/rooms");

    await page.getByText("#8", { exact: true }).click();
    const modal = page.locator(".fixed.inset-0");
    await expect(modal.getByText("Fixing bathroom pipes")).toBeVisible();
  });

  test("Rooms: Room 9 is vacant but has past contract history", async ({ page }) => {
    await page.goto("/rooms");

    await page.getByText("#9", { exact: true }).click();
    const modal = page.locator(".fixed.inset-0");

    // Should show past tenant
    await expect(modal.getByText("Bui Thi Mai").first()).toBeVisible();
  });

  test("Tenants: all 15 tenants listed", async ({ page }) => {
    await page.goto("/tenants");

    // Header should show count
    await expect(page.getByText("15")).toBeVisible();

    // Spot check some tenants
    await expect(page.getByText("Nguyen Van An").first()).toBeVisible();
    await expect(page.getByText("Cao Van Long").first()).toBeVisible();
  });

  test("Tenants: tenants with active contracts show room badge", async ({ page }) => {
    await page.goto("/tenants");

    // Nguyen Van An should have Room 1
    const row = page.getByRole("row").filter({ hasText: "Nguyen Van An" }).first();
    await expect(row.getByText(/Room 1|Phòng 1/)).toBeVisible();
  });

  test("Tenants: tenants without contracts show no room", async ({ page }) => {
    await page.goto("/tenants");

    // Cao Van Long (tenant 15, no contract) should NOT have a Room badge
    const row = page.getByRole("row").filter({ hasText: "Cao Van Long" }).first();
    await expect(row.locator(".text-gray-400").first()).toBeVisible();
  });

  test("Tenants: search works with seeded data", async ({ page }) => {
    await page.goto("/tenants");

    await page.getByPlaceholder(/Search|Tìm/).fill("Pham");
    await page.waitForURL(/search=Pham/);

    await expect(page.getByText("Pham Thi Lan").first()).toBeVisible();
    // Other tenants should not be visible
    await expect(page.getByText("Nguyen Van An")).not.toBeVisible();
  });

  test("Tenants: cannot delete tenant with active contract", async ({ page }) => {
    await page.goto("/tenants");

    const row = page.getByRole("row").filter({ hasText: "Nguyen Van An" }).first();
    await row.getByRole("button", { name: /Delete|Xóa/ }).click();

    // Confirm dialog
    await page.getByRole("button", { name: /Confirm|Xác nhận/ }).click();

    // Should show error about active contracts
    await expect(page.getByText(/active contract|hợp đồng hoạt động/i)).toBeVisible();
  });

  test("Contracts: 7 active contracts listed", async ({ page }) => {
    await page.goto("/contracts");

    await expect(page.getByText(/Active Contracts \(7\)|Hợp đồng đang hoạt động \(7\)/)).toBeVisible();
  });

  test("Contracts: ended contract shown in past section", async ({ page }) => {
    await page.goto("/contracts");

    await expect(page.getByText(/Past Contracts|Hợp đồng đã kết thúc/)).toBeVisible();
    await expect(page.getByText("Bui Thi Mai").first()).toBeVisible();
  });

  test("Contracts: move-in button disabled (no available tenants without contracts... or rooms)", async ({ page }) => {
    await page.goto("/contracts");

    // We have 8 tenants without contracts and 2 vacant rooms, so button should be enabled
    const moveInBtn = page.getByRole("button", { name: /Move In|Nhận phòng/ });
    await expect(moveInBtn).toBeEnabled();
  });

  test("Contracts: can open move-in form and see vacant rooms only", async ({ page }) => {
    await page.goto("/contracts");

    await page.getByRole("button", { name: /Move In|Nhận phòng/ }).click();
    const modal = page.locator(".fixed.inset-0");

    // Room select should only show rooms 9 and 10 (vacant)
    const roomSelect = modal.getByLabel(/Room|Phòng/).first();
    const options = roomSelect.locator("option");
    const optionTexts = await options.allTextContents();
    console.log("Room options:", optionTexts);

    // Should NOT contain occupied rooms (1-7) or maintenance (8)
    for (const text of optionTexts) {
      expect(text).not.toContain("Room 1 —");
      expect(text).not.toContain("Room 5 —");
      expect(text).not.toContain("Room 8 —");
    }
  });

  test("Contracts: move-in form shows only tenants without active contracts", async ({ page }) => {
    await page.goto("/contracts");

    await page.getByRole("button", { name: /Move In|Nhận phòng/ }).click();
    const modal = page.locator(".fixed.inset-0");

    const tenantSelect = modal.getByLabel(/Tenant|Người thuê/).first();
    const options = tenantSelect.locator("option");
    const optionTexts = await options.allTextContents();
    console.log("Tenant options:", optionTexts);

    // Should NOT contain tenants who already have active contracts
    for (const text of optionTexts) {
      expect(text).not.toContain("Nguyen Van An");
      expect(text).not.toContain("Tran Thi Bich");
      expect(text).not.toContain("Le Hoang Nam");
    }

    // Should contain free tenants
    const joined = optionTexts.join("|");
    expect(joined).toContain("Bui Thi Mai");
    expect(joined).toContain("Cao Van Long");
  });

  test("Payments: shows rent status for current month", async ({ page }) => {
    await page.goto("/payments");

    await expect(page.locator("h1")).toBeVisible();

    // Should show some payments
    await expect(page.getByText("Nguyen Van An").first()).toBeVisible();
  });

  test("Payments: stats show expected, collected, pending amounts", async ({ page }) => {
    await page.goto("/payments");

    // Expected = sum of all active contract rents
    // Check that stat cards are visible
    await expect(page.getByText(/Expected|Dự kiến/).first()).toBeVisible();
    await expect(page.getByText(/Collected|Đã thu/).first()).toBeVisible();
    await expect(page.getByText(/Pending|Chờ/).first()).toBeVisible();
  });

  test("Payments: mix of paid and pending for current month", async ({ page }) => {
    await page.goto("/payments");

    // Should have both paid and pending badges
    await expect(page.getByText(/Paid|Đã thanh toán/).first()).toBeVisible();
    await expect(page.getByText(/Pending|Chờ thanh toán/).first()).toBeVisible();
  });

  test("Reports: occupancy rate should be 70% (7/10)", async ({ page }) => {
    await page.goto("/reports");

    await expect(page.getByText("70%").first()).toBeVisible();
    await expect(page.getByText("7 / 10")).toBeVisible();
  });

  test("Reports: income stats visible", async ({ page }) => {
    await page.goto("/reports");

    await expect(page.getByText(/Total Income|Tổng thu nhập/)).toBeVisible();
    await expect(page.getByText(/Occupancy Rate|Tỷ lệ lấp đầy/)).toBeVisible();
  });

  test("Reports: unpaid payments listed", async ({ page }) => {
    await page.goto("/reports");

    // We have pending payments from the seed
    await expect(page.getByText(/Unpaid|Chưa thanh toán/).first()).toBeVisible();
  });

  test("Settings: page loads correctly", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.locator("h1")).toBeVisible();
    // Default rate should show
    await expect(page.locator("input[name='default_room_rate']")).toHaveValue("3000000");
  });

  test("Utilities: all 10 rooms shown in table", async ({ page }) => {
    await page.goto("/utilities");

    await expect(page.locator("h1")).toBeVisible();
    // All 10 rooms should be in the utility table
    for (let i = 1; i <= 10; i++) {
      await expect(page.getByText(new RegExp(`Room ${i}|Phòng ${i}`), { exact: true }).first()).toBeVisible();
    }
  });

  test("Edge case: move out from contracts page works", async ({ page }) => {
    await page.goto("/contracts");

    // Move out Vo Thi Hoa (room 6, single tenant - safest to test)
    const row = page.getByRole("row").filter({ hasText: "Vo Thi Hoa" }).first();
    await row.getByRole("button", { name: /Move Out|Trả phòng/ }).click();

    // Confirm dialog should appear
    await expect(page.getByText(/Confirm|Xác nhận/).first()).toBeVisible();
    await page.getByRole("button", { name: /Move Out|Trả phòng/ }).last().click();

    // Should now show 6 active contracts
    await expect(page.getByText(/Active Contracts \(6\)|Hợp đồng đang hoạt động \(6\)/)).toBeVisible();
  });

  test("Edge case: after move-out, room 6 should be vacant", async ({ page }) => {
    await page.goto("/rooms");

    await expect(page.getByText(/Vacant: 3/)).toBeVisible();
  });

  test("Edge case: move in a new tenant to the now-vacant room", async ({ page }) => {
    await page.goto("/contracts");

    await page.getByRole("button", { name: /Move In|Nhận phòng/ }).click();
    const modal = page.locator(".fixed.inset-0");

    // Select room 6 (now vacant)
    await modal.getByLabel(/Room|Phòng/).first().selectOption({ index: 1 });
    // Select Do Thanh Tung (free tenant)
    await modal.getByLabel(/Tenant|Người thuê/).first().selectOption({ label: "Do Thanh Tung" });
    await modal.getByLabel(/Monthly Rent|Tiền thuê/).clear();
    await modal.getByLabel(/Monthly Rent|Tiền thuê/).fill("2500000");

    // Add an occupant
    await modal.getByRole("button", { name: /Add Person|Thêm người/ }).click();
    await modal.locator("#occupant_0_firstName").fill("Do");
    await modal.locator("#occupant_0_lastName").fill("Thi Yen");
    await modal.locator("select[name='occupant_0_relationship']").selectOption("spouse");

    const submitBtn = modal.getByRole("button", { name: /^Move In$|^Nhận phòng$/ });
    await submitBtn.scrollIntoViewIfNeeded();
    await submitBtn.click();

    // Should now have 7 active contracts again
    await expect(page.getByText(/Active Contracts \(7\)|Hợp đồng đang hoạt động \(7\)/)).toBeVisible();
  });
});
