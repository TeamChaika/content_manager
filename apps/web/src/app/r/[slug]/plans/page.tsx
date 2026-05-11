import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, Calendar, Plus } from "lucide-react";

interface Plan {
  id: string;
  restaurant_id: string;
  period_start: string;
  period_end: string;
  status: "draft" | "pending_approval" | "approved" | "rejected";
  created_at: string;
}

const statusMap: Record<
  string,
  { label: string; className: string }
> = {
  draft: {
    label: "Черновик",
    className: "bg-gray-700 text-gray-300",
  },
  pending_approval: {
    label: "На согласовании",
    className: "bg-yellow-900/60 text-yellow-400",
  },
  approved: {
    label: "Согласован",
    className: "bg-green-900/60 text-green-400",
  },
  rejected: {
    label: "Отклонён",
    className: "bg-red-900/60 text-red-400",
  },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU");
}

export default async function PlansPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!restaurant) notFound();

  const { data: plans } = await supabase
    .from("content_plans")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Все заведения
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">
          {restaurant.name} — Контент-планы
        </h1>
        <button
          disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-brand/20 px-4 py-2 text-sm font-medium text-brand/50"
        >
          <Plus className="h-4 w-4" />
          Создать план
        </button>
      </div>

      {!plans || plans.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <p className="text-lg">Нет контент-планов</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {plans.map((plan: Plan) => {
            const status =
              statusMap[plan.status] ?? statusMap.draft;
            return (
              <Link
                key={plan.id}
                href={`/r/${slug}/plans/${plan.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-800 bg-card p-4 transition-all hover:border-brand/30 hover:bg-card-hover group"
              >
                <div className="flex items-center gap-4">
                  <Calendar className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="font-medium text-white transition-colors group-hover:text-brand">
                      {plan.period_start
                        ? `${formatDate(plan.period_start)} — ${formatDate(plan.period_end)}`
                        : "Без дат"}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                >
                  {status.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
