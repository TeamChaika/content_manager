"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function login(prevState: { message: string; error: string }, formData: FormData) {
  const email = formData.get("email") as string;

  if (!email) {
    return { message: "", error: "Введите email" };
  }

  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") || headersList.get("host") || "";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { message: "", error: error.message };
  }

  return { message: "Проверьте почту", error: "" };
}
