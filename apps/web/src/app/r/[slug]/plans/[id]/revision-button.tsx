"use client";

import { useState } from "react";
import { requestRevision } from "./actions";

export function RevisionButton({
  planId,
  slug,
}: {
  planId: string;
  slug: string;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-yellow-900/30 px-4 py-2 text-sm font-medium text-yellow-400 transition-colors hover:bg-yellow-900/50"
      >
        Запросить правки
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await requestRevision(planId, slug, comment);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Опишите необходимые правки..."
        rows={3}
        className="w-full rounded-lg border border-gray-700 bg-card px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-brand focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!comment.trim() || submitting}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? "Отправка..." : "Отправить"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
