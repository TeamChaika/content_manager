"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavbarProps {
  user: { full_name: string } | null;
}

export function Navbar({ user }: NavbarProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800 bg-bg/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-lg font-semibold text-amber-400 transition-colors hover:text-amber-300"
        >
          Hungry Club
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className={cn("text-sm text-gray-300")}>
                {user.full_name}
              </span>
              <button
                onClick={handleLogout}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm text-gray-400 transition-colors",
                  "hover:bg-gray-800 hover:text-gray-200"
                )}
              >
                Выйти
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
            >
              Войти
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
