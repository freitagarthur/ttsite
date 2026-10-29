"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "./Providers";

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/analise-ativo" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-700 text-white">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M14 7h7v7" />
        </svg>
      </span>
      <span className="text-lg">
        Trade<span className="text-brand-500">Tutor</span>
      </span>
    </Link>
  );
}

export function Header() {
  const { theme, toggleTheme, user, logout } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const isAsset = pathname?.startsWith("/analise-ativo");

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-ink-600/60 dark:bg-ink-900/80">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Logo />

        <nav className="order-3 flex w-full gap-2 sm:order-none sm:w-auto">
          <Link
            href="/analise-ativo"
            className={`flex-1 rounded-full px-4 py-2 text-center text-sm font-medium transition sm:flex-none ${
              isAsset
                ? "bg-brand-500 text-white shadow-lg shadow-brand-500/25"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-ink-700"
            }`}
          >
            Análise de Ativo
          </Link>
          <button
            type="button"
            disabled
            title="Disponível em breve"
            className="flex-1 cursor-not-allowed rounded-full px-4 py-2 text-sm font-medium text-slate-400 opacity-60 dark:text-slate-500 sm:flex-none"
          >
            Análise de Trades <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] uppercase dark:bg-ink-600">em breve</span>
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            title={theme === "dark" ? "Tema claro" : "Tema escuro"}
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-ink-600 dark:text-slate-300 dark:hover:bg-ink-700"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden max-w-[160px] truncate text-sm text-slate-500 dark:text-slate-400 md:inline">
                Olá, {user.name?.split(" ")[0] || user.email}
              </span>
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-ink-600 dark:hover:bg-ink-700"
              >
                Sair
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-ink-600 dark:hover:bg-ink-700"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
