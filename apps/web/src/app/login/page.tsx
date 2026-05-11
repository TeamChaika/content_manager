import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-xl bg-card p-8 shadow-lg">
        <h1 className="mb-2 text-center text-2xl font-bold text-white">
          Hungry Club
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-400">
          Войдите в панель управления контентом
        </p>

        {error === "auth_failed" && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            Ошибка авторизации. Попробуйте ещё раз.
          </div>
        )}

        {error && error !== "auth_failed" && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <LoginForm />
      </div>
    </main>
  );
}
