"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function approvePlan(planId: string, slug: string) {
  const supabase = await createClient();
  await supabase
    .from("content_plans")
    .update({ status: "approved" })
    .eq("id", planId);
  revalidatePath(`/r/${slug}/plans/${planId}`);
}

export async function requestRevision(
  planId: string,
  slug: string,
  comment: string,
) {
  const supabase = await createClient();
  await supabase
    .from("content_plans")
    .update({ status: "rejected", revision_comment: comment })
    .eq("id", planId);
  revalidatePath(`/r/${slug}/plans/${planId}`);
}

export async function deleteItem(
  itemId: string,
  planId: string,
  slug: string,
) {
  const supabase = await createClient();
  await supabase
    .from("content_items")
    .delete()
    .eq("id", itemId);
  revalidatePath(`/r/${slug}/plans/${planId}`);
}
