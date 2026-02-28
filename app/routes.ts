import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  index("routes/dashboard.tsx"),
  route("rooms", "routes/rooms.tsx"),
  route("tenants", "routes/tenants.tsx"),
  route("contracts", "routes/contracts.tsx"),
  route("payments", "routes/payments.tsx"),
  route("utilities", "routes/utilities.tsx"),
  route("reports", "routes/reports.tsx"),
  route("settings", "routes/settings.tsx"),
] satisfies RouteConfig;
