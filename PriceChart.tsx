"use client";

import { useEffect, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type LogicalRange,
  type Time,
} from "lightweight-charts";
import type { AssetAnalysis } from "@/lib/api";
import { useApp } from "./Providers";

const SMA_COLORS = { sma9: "#f59e0b", sma21: "#3b82f6", sma200: "#a855f7" };

export function PriceChart({ chart }: { chart: AssetAnalysis["chart"] }) {
  const priceRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const { theme } = useApp();

  useEffect(() => {
    if (!priceRef.current || !rsiRef.current) return;
    const dark = theme === "dark";
    const base = {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: dark ? "#94a3b8" : "#475569",
        fontFamily: "Inter, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: dark ? "rgba(42,55,83,0.5)" : "rgba(226,232,240,0.9)" },
        horzLines: { color: dark ? "rgba(42,55,83,0.5)" : "rgba(226,232,240,0.9)" },
      },
      rightPriceScale: { borderColor: dark ? "#2a3753" : "#e2e8f0", minimumWidth: 70 },
      timeScale: { borderColor: dark ? "#2a3753" : "#e2e8f0" },
      crosshair: { mode: CrosshairMode.Normal },
      localization: {
        locale: "pt-BR",
        priceFormatter: (p: number) => p.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      },
      autoSize: true,
    };

    const priceChart: IChartApi = createChart(priceRef.current, base);
    const rsiChart: IChartApi = createChart(rsiRef.current, base);

    const candles = priceChart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
    candles.setData(chart.candles.map((c) => ({ ...c, time: c.time as Time })));

    (Object.keys(SMA_COLORS) as (keyof typeof SMA_COLORS)[]).forEach((key) => {
      const s = priceChart.addLineSeries({
        color: SMA_COLORS[key],
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      s.setData(chart[key].map((p) => ({ time: p.time as Time, value: p.value })));
    });

    const rsi = rsiChart.addLineSeries({ color: "#14b8a6", lineWidth: 2, priceLineVisible: false });
    // Preenche com pontos vazios para alinhar o índice lógico com o gráfico de preços
    const rsiMap = new Map(chart.rsi14.map((p) => [p.time, p.value]));
    rsi.setData(
      chart.candles.map((c) =>
        rsiMap.has(c.time) ? { time: c.time as Time, value: rsiMap.get(c.time)! } : { time: c.time as Time }
      )
    );
    [70, 30].forEach((level) =>
      rsi.createPriceLine({
        price: level,
        color: level === 70 ? "#ef4444" : "#10b981",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: level === 70 ? "Sobrecompra" : "Sobrevenda",
      })
    );
    rsiChart.priceScale("right").applyOptions({ autoScale: false, scaleMargins: { top: 0.1, bottom: 0.1 } });
    rsi.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) });

    // Sincroniza zoom/pan entre os dois painéis
    let syncing = false;
    const sync = (target: IChartApi) => (range: LogicalRange | null) => {
      if (syncing || !range) return;
      syncing = true;
      target.timeScale().setVisibleLogicalRange(range);
      syncing = false;
    };
    priceChart.timeScale().subscribeVisibleLogicalRangeChange(sync(rsiChart));
    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(sync(priceChart));

    // Mostra inicialmente os últimos ~180 pregões
    const n = chart.candles.length;
    priceChart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 180), to: n + 3 });

    return () => {
      priceChart.remove();
      rsiChart.remove();
    };
  }, [chart, theme]);

  return (
    <div className="card p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Gráfico de preços</h2>
        <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
          <Legend color={SMA_COLORS.sma9} label="MMA 9" />
          <Legend color={SMA_COLORS.sma21} label="MMA 21" />
          <Legend color={SMA_COLORS.sma200} label="MMA 200" />
        </div>
      </div>
      <div ref={priceRef} className="h-[420px] w-full" />
      <div className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        <Legend color="#14b8a6" label="IFR 14" />
      </div>
      <div ref={rsiRef} className="h-[160px] w-full" />
      <p className="mt-2 text-xs text-slate-400">Use a roda do mouse para zoom e arraste para navegar no histórico.</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-0.5 w-4 rounded" style={{ background: color }} />
      {label}
    </span>
  );
}
