import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        draft: "bg-gray-700 text-gray-300",
        pending: "bg-amber-400/20 text-amber-400",
        approved: "bg-green-600/20 text-green-400",
        rejected: "bg-red-600/20 text-red-400",
        published: "bg-blue-600/20 text-blue-400",
        in_production: "bg-purple-600/20 text-purple-400",
      },
    },
    defaultVariants: { variant: "draft" },
  }
);

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

const statusLabels: Record<string, string> = {
  draft: "Черновик",
  pending_approval: "На согласовании",
  approved: "Согласован",
  rejected: "Отклонён",
  published: "Опубликован",
  in_production: "В производстве",
  planned: "Запланирован",
  brief_ready: "ТЗ готово",
  awaiting_shoot: "Ожидает съёмки",
  media_uploaded: "Медиа загружено",
  media_generated: "Медиа сгенерировано",
  copy_ready: "Текст готов",
};

const statusVariantMap: Record<string, BadgeVariant> = {
  draft: "draft",
  pending_approval: "pending",
  approved: "approved",
  rejected: "rejected",
  published: "published",
  in_production: "in_production",
  planned: "draft",
  brief_ready: "pending",
  awaiting_shoot: "pending",
  media_uploaded: "in_production",
  media_generated: "in_production",
  copy_ready: "pending",
};

function getStatusLabel(status: string): string {
  return statusLabels[status] ?? status;
}

function getStatusVariant(status: string): BadgeVariant {
  return statusVariantMap[status] ?? "draft";
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  status?: string;
}

export function Badge({ className, variant, status, children, ...props }: BadgeProps) {
  const resolvedVariant = status ? getStatusVariant(status) : variant;
  const label = status ? getStatusLabel(status) : undefined;

  return (
    <span className={cn(badgeVariants({ variant: resolvedVariant }), className)} {...props}>
      {label ?? children}
    </span>
  );
}

export { badgeVariants, statusLabels, getStatusLabel };
