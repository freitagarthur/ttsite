"use client";

import dynamic from "next/dynamic";
import { fmtDate, fmtNum, fmtPct, type AssetAnalysis } from "@/lib/api";

const PriceChart = dynamic(() => import("./PriceChart").then((m) => m.PriceChart), {
  ssr: false,
  loading: () => <div className="card h-[620px] animate-pulse" />,
});

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "up" | "down" }) {
  const color = tone === "up" ? "text-brand-500" : tone === "down" ? "text-red-500" : "";
  return (
    <div className="card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

function rsiLabel(v: number | null) {
  if (v == null) return undefined;
  if (v >= 70) return "Zona de sobrecompra (≥ 70)";
  if (v <= 30) return "Zona de sobrevenda (≤ 30)";
  return "Zona neutra (30–70)";
}

function corrLabel(v: number | null) {
  if (v == null) return undefined;
  const a = Math.abs(v);
  const force = a >= 0.7 ? "forte" : a >= 0.4 ? "moderada" : a >= 0.2 ? "fraca" : "muito fraca";
  return `Correlação ${force} ${v >= 0 ? "positiva" : "negativa"}`;
}

export function AssetResults({ data }: { data: AssetAnalysis }) {
  const { descriptive: d, statistics: s } = data;
  const tone = (v: number | null) => (v == null ? undefined : v >= 0 ? "up" : "down");

  return (
    <div className="space-y-8">
      {data.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          {data.warnings.map((w) => (
            <p key={w}>⚠ {w}</p>
          ))}
        </div>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold">Análise descritiva</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Ativo" value={d.asset} hint={d.last_close != null ? `Último fechamento: ${fmtNum(d.last_close)}` : undefined} />
          <Stat label="Quantidade de dias" value={d.days.toLocaleString("pt-BR")} hint="Pregões no arquivo" />
          <Stat label="Início dos dados" value={fmtDate(d.start_date)} />
          <Stat label="Fim dos dados" value={fmtDate(d.end_date)} />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Análise estatística</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Variação diária média" value={fmtPct(s.mean_daily_change_pct, 3)} tone={tone(s.mean_daily_change_pct)} hint={`Desvio padrão: ${fmtPct(s.std_daily_change_pct)}`} />
          <Stat label="Variação diária média absoluta" value={fmtPct(s.mean_abs_daily_change_pct)} hint="Média dos movimentos sem sinal" />
          <Stat label="Maior alta diária" value={fmtPct(s.max_daily_gain_pct)} tone="up" hint={fmtDate(s.max_daily_gain_date)} />
          <Stat label="Maior queda diária" value={fmtPct(s.max_daily_loss_pct)} tone="down" hint={fmtDate(s.max_daily_loss_date)} />
          <Stat
            label="Frequência de gaps"
            value={fmtPct(s.gaps.frequency_pct, 1)}
            hint={`${s.gaps.total} gaps em ${s.gaps.days_compared} dias (${s.gaps.up} de alta, ${s.gaps.down} de baixa)`}
          />
          <Stat label="Máxima atual × MMA 200" value={fmtPct(s.last_high_vs_sma200_pct)} hint="Distância percentual absoluta" />
          <Stat label="IFR 14 atual" value={fmtNum(s.rsi14)} hint={rsiLabel(s.rsi14)} />
          <Stat
            label="Correlação com IBOV"
            value={fmtNum(s.ibov_correlation.value, 3)}
            hint={s.ibov_correlation.value != null ? `${corrLabel(s.ibov_correlation.value)} · ${s.ibov_correlation.days} dias` : s.ibov_correlation.message ?? undefined}
          />
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-ink-600/70">
          <h2 className="text-lg font-semibold">Distância do fechamento às médias móveis aritméticas</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Valores percentuais absolutos</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-ink-700/50 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3">Média</th>
                <th className="px-5 py-3 text-right">Valor atual</th>
                <th className="px-5 py-3 text-right">Distância atual</th>
                <th className="px-5 py-3 text-right">Distância média</th>
                <th className="px-5 py-3 text-right">Distância máxima</th>
              </tr>
            </thead>
            <tbody>
              {(["9", "21", "200"] as const).map((p) => {
                const m = s.sma[p];
                return (
                  <tr key={p} className="border-t border-slate-100 dark:border-ink-600/50">
                    <td className="px-5 py-3 font-medium">MMA {p}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtNum(m?.current_value)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtPct(m?.current_distance_pct)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtPct(m?.mean_distance_pct)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtPct(m?.max_distance_pct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <PriceChart chart={data.chart} />
    </div>
  );
}
