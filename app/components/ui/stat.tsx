import { cn } from "~/lib/utils";

interface StatProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: string; positive: boolean };
  className?: string;
}

export function Stat({ label, value, icon, trend, className }: StatProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        {icon && <div className="text-gray-400 dark:text-gray-500">{icon}</div>}
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {trend && (
        <p
          className={cn(
            "mt-1 text-sm",
            trend.positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )}
        >
          {trend.value}
        </p>
      )}
    </div>
  );
}
