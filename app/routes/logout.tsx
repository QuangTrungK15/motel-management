import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { logout } from "~/lib/auth.server";

export async function action({ request }: Route.ActionArgs) {
  const sessionCookie = await logout(request);
  return redirect("/login", {
    headers: { "Set-Cookie": sessionCookie },
  });
}

export async function loader() {
  return redirect("/login");
}
