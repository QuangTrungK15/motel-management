import { Form, useNavigation, redirect } from "react-router";
import type { Route } from "./+types/login";
import { login, requireAuth } from "~/lib/auth.server";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Alert } from "~/components/ui/alert";

export function meta() {
  return [{ title: "Login - NhaTro" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  try {
    await requireAuth(request);
    return redirect("/");
  } catch {
    return {};
  }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return { error: "Please enter both username and password." };
  }

  const sessionCookie = await login(username, password);
  if (!sessionCookie) {
    return { error: "Invalid username or password." };
  }

  return redirect("/", {
    headers: { "Set-Cookie": sessionCookie },
  });
}

export default function Login({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const error = actionData && "error" in actionData ? actionData.error : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-primary-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
            NhaTro
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Sign in to manage your property
          </p>
        </div>

        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <Form method="post" className="space-y-4">
            <Input
              id="username"
              label="Username"
              name="username"
              type="text"
              autoComplete="username"
              required
            />
            <Input
              id="password"
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}
