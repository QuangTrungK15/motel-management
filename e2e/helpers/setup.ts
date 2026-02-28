import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import type { Page } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

export function resetDatabase() {
  execSync("npx prisma db push --force-reset --skip-generate", {
    cwd: ROOT,
    stdio: "pipe",
  });
  execSync("npx tsx prisma/seed.ts", {
    cwd: ROOT,
    stdio: "pipe",
  });
}

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("/");
}
