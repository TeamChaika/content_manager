"use client";

import { useActionState } from "react";
import { login } from "./actions";

const initialState = {
  message: "",
  error: "",
};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);

  if (state.message) {
    return (
      <div className="rounded-lg border border-brand/30 bg-brand/5 px-4 py-4 text-center">
        <p className="font-medium text-brand">Проверьте почту</p>
        <p className="mt-1 text-sm text-zinc-400">
          Мы отправили ссылку для входа на указанный email
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-300">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="manager@hungryclub.ru"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Отправка..." : "Войти"}
      </button>
    </form>
  );
}
