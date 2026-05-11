import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hungry Club Content",
  description:
    "Управление контентом для сети заведений Hungry Club в Ялте",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800 bg-black/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link
              href="/"
              className="text-lg font-bold text-brand hover:opacity-80 transition-opacity"
            >
              Hungry Club
            </Link>
            <span className="text-sm text-gray-400">Войти</span>
          </div>
        </nav>
        <main className="min-h-screen pt-16">{children}</main>
      </body>
    </html>
  );
}
