import { createCookieSessionStorage, redirect } from "react-router";
import bcrypt from "bcryptjs";
import { prisma } from "~/lib/db.server";

function getSessionSecret(): string {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.SESSION_SECRET) {
      throw new Error("SESSION_SECRET must be set in production");
    }
    return process.env.SESSION_SECRET;
  }
  return process.env.SESSION_SECRET || "default-dev-secret";
}

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [getSessionSecret()],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
});

function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function requireAuth(request: Request): Promise<number> {
  const session = await getSession(request);
  const userId = session.get("userId");
  if (!userId) {
    throw redirect("/login");
  }

  // Verify the user still exists in the database
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw redirect("/login", {
      headers: {
        "Set-Cookie": await sessionStorage.destroySession(session),
      },
    });
  }

  return userId;
}

export async function login(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;

  const session = await sessionStorage.getSession();
  session.set("userId", user.id);
  return sessionStorage.commitSession(session);
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return sessionStorage.destroySession(session);
}
