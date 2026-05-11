import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Trash2,
  PenLine,
} from "lucide-react";
import { RevisionButton } from "./revision-button";
import { approvePlan, deleteItem } from "./actions";

interface JsonItem {
  date: string;
  format: "post" | "reel" | "story";
  topic: string;
  goal: string;
  key_message: string;
  suggested_visual?: string;
  rationale?: string;
}

interface Plan {
  id: string;
  restaurant_id: string;
  period_start: string;
  period_end: string;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "in_production";
  strategist_output: {
    plan_summary?: string;
    items?: JsonItem[];
  } | null;
}

const statusMap: Record<
  string,
  { label: string; wideClass: string }
> = {
  draft: {
    label: "Черновик",
    wideClass: "bg-gray-700 text-gray-300",
  },
  pending_approval: {
    label: "На согласовании",
    wideClass: "bg-yellow-900/60 text-yellow-400",
  },
  approved: {
    label: "Согласован",
    wideClass: "bg-green-900/60 text-green-400",
  },
  rejected: {
    label: "Отклонён",
    wideClass: "bg-red-900/60 text-red-400",
  },
};

const formatLabels: Record<string, string> = {
  post: "Пост",
  reel: "Reels",
  story: "Сторис",
};

const formatIcons: Record<string, string> = {
  post: "📄",
  reel: "🎬",
  story: "📱",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU");
}

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  const supabase = await createClient();

  const { data: plan } = (await supabase
    .from("content_plans")
    .select("*")
    .eq("id", id)
    .single()) as { data: Plan | null };

  if (!plan) notFound();

  const { data: dbItems } = await supabase
    .from("content_items")
    .select("*")
    .eq("plan_id", id)
    .order("scheduled_date");

  const jsonItems = (plan.strategist_output as any)?.items || [];
  const items = dbItems && dbItems.length > 0 ? dbItems : jsonItems;
  const isFromJson = dbItems?.length === 0;

  const status = statusMap[plan.status] ?? statusMap.draft;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href={`/r/${slug}/plans`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Контент-планы
      </Link>

      <div className="mb-6 rounded-lg border border-gray-800 bg-card p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">
              Контент-план
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-gray-400">
              <Calendar className="h-4 w-4" />
              {plan.period_start
                ? `${formatDate(plan.period_start)} — ${formatDate(plan.period_end)}`
                : "Без дат"}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${status.wideClass}`}
          >
            {status.label}
          </span>
        </div>

        {plan.strategist_output?.plan_summary && (
          <div className="rounded-lg border border-gray-800 bg-bg p-4">
            <p className="text-sm font-medium text-gray-400 mb-1">
              Общее описание
            </p>
            <p className="text-sm text-gray-200 whitespace-pre-wrap">
              {plan.strategist_output.plan_summary}
            </p>
          </div>
        )}
      </div>

      {plan.status !== "approved" && (
        <div className="mb-6 flex flex-wrap gap-3">
          <form
            action={approvePlan.bind(null, plan.id, slug)}
          >
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600"
            >
              <CheckCircle className="h-4 w-4" />
              Согласовать
            </button>
          </form>
          <RevisionButton planId={plan.id} slug={slug} />
        </div>
      )}

      <div className="rounded-lg border border-gray-800 bg-card overflow-hidden">
        <div className="border-b border-gray-800 px-6 py-3">
          <h2 className="text-lg font-semibold text-white">
            Материалы ({Array.isArray(items) ? items.length : 0})
          </h2>
        </div>

        {!items || items.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            Нет материалов
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {items.map((item: any, idx: number) => {
              const date = item.scheduled_date || item.date;
              const msg = item.key_message || item.copy_text;
              return (
              <div
                key={item.id || idx}
                className="flex items-start gap-3 px-6 py-4 transition-colors hover:bg-card-hover group"
              >
                <div className="mt-0.5 text-lg shrink-0">
                  {formatIcons[item.format] ?? "📄"}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="inline-block rounded border-b border-dashed border-gray-600 px-1.5 py-0.5 text-sm font-medium text-white">
                      {date ? formatDate(date) : "—"}
                    </span>
                    <span className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400">
                      {formatLabels[item.format] ?? item.format}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-brand">
                    {item.topic || "Без темы"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {item.goal || "—"}
                  </p>
                  {msg && (
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {msg}
                    </p>
                  )}
                </div>
                {item.id && (
                <form
                  action={deleteItem.bind(null, item.id, plan.id, slug)}
                >
                  <button
                    type="submit"
                    className="rounded p-1 text-gray-600 transition-colors hover:bg-red-900/30 hover:text-red-400 opacity-0 group-hover:opacity-100"
                    title="Удалить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
                )}
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}
