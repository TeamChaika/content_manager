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

export async function regeneratePlan(planId: string, slug: string) {
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("content_plans")
    .select("restaurant_id, strategist_input, feedback_history")
    .eq("id", planId)
    .single();

  await supabase.from("jobs").insert({
    type: "regenerate_plan",
    payload: {
      plan_id: planId,
      restaurant_id: plan?.restaurant_id,
      previous_input: plan?.strategist_input,
      feedback: "Перегенерировать с нуля",
    },
  });

  revalidatePath(`/r/${slug}/plans/${planId}`);
}

export async function regenerateItem(
  itemId: string,
  planId: string,
  slug: string,
) {
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("content_items")
    .select("*, content_plans(restaurant_id)")
    .eq("id", itemId)
    .single();

  const restaurantId = (item as any)?.content_plans?.restaurant_id;

  await supabase.from("jobs").insert({
    type: "generate_copy",
    payload: {
      plan_id: planId,
      item_id: itemId,
      restaurant_id: restaurantId,
      previous_topic: item?.topic,
      previous_text: item?.copy_text,
      feedback: "Перегенерировать отдельно",
    },
  });

  revalidatePath(`/r/${slug}/plans/${planId}`);
}
