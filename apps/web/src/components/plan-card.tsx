import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface Plan {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  created_at: string;
}

interface PlanCardProps {
  plan: Plan;
  restaurantSlug: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PlanCard({ plan, restaurantSlug }: PlanCardProps) {
  return (
    <Link
      href={`/r/${restaurantSlug}/plans/${plan.id}`}
      className="block rounded-xl border border-gray-800 bg-card p-4 transition-colors hover:border-gray-600 hover:bg-card-hover"
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-gray-200">
            {formatDate(plan.period_start)} — {formatDate(plan.period_end)}
          </p>
          <p className="text-xs text-gray-500">
            Создан {formatDate(plan.created_at)}
          </p>
        </div>
        <Badge status={plan.status} />
      </div>
    </Link>
  );
}
