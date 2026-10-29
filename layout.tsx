import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "TradeTutor — Análise de ativos e trades",
  description: "Análise estatística de ativos da bolsa: médias móveis, IFR, gaps e correlação com o IBOV.",
};

// Aplica o tema salvo antes da renderização para evitar "piscar".
const themeScript = `(function(){try{var t=localStorage.getItem('tt_theme');if(t!=='light'){document.documentElement.classList.add('dark')}}catch(e){document.documentElement.classList.add('dark')}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans">
        <Providers>
          <Header />
          <main className="hero-glow">{children}</main>
          <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 dark:border-ink-600/60 dark:text-slate-500">
            © {new Date().getFullYear()} TradeTutor · As análises têm caráter educacional e não constituem recomendação de investimento.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
