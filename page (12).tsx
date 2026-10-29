"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AssetResults } from "@/components/AssetResults";
import { useApp } from "@/components/Providers";
import { apiFetch, ApiError, type AssetAnalysis } from "@/lib/api";

const ALLOWED = [".csv", ".xlsx"];
const MAX_MB = 20;

export default function AnaliseAtivoPage() {
  const { user, loadingUser } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssetAnalysis | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function pick(f: File | null | undefined) {
    setError(null);
    setResult(null);
    if (!f) return setFile(null);
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED.includes(ext)) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      return setError("Formato inválido. Selecione um arquivo .csv ou .xlsx.");
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFile(null);
      return setError(`Arquivo muito grande (máximo ${MAX_MB} MB).`);
    }
    setFile(f);
  }

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      setResult(await apiFetch<AssetAnalysis>("/analysis/asset", { method: "POST", body: form }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado ao analisar o arquivo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <section className="mx-auto max-w-3xl text-center">
        <span className="inline-block rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-600 dark:text-brand-400">
          Análise de Ativo
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
          Entenda o comportamento <span className="bg-gradient-to-r from-brand-400 to-brand-700 bg-clip-text text-transparent">do seu ativo</span>
        </h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          Envie o histórico diário (data, open, high, low, close) e receba estatísticas de volatilidade, médias móveis, IFR, gaps e
          correlação com o IBOV.
        </p>
      </section>

      <section className="card mx-auto mt-10 max-w-3xl p-6 sm:p-8">
        {!loadingUser && !user ? (
          <div className="text-center">
            <p className="text-slate-600 dark:text-slate-300">Faça login para enviar seus arquivos e salvar o histórico de análises.</p>
            <div className="mt-5 flex justify-center gap-3">
              <Link href="/login" className="btn-primary">Entrar</Link>
              <Link href="/cadastro" className="btn-outline">Criar conta</Link>
            </div>
          </div>
        ) : (
          <>
            <label
              htmlFor="file"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pick(e.dataTransfer.files?.[0]);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
                dragOver ? "border-brand-500 bg-brand-500/5" : "border-slate-300 hover:border-brand-500 dark:border-ink-500"
              }`}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-brand-500">
                <path d="M12 16V4M7 9l5-5 5 5" />
                <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
              </svg>
              <p className="mt-3 font-medium">{file ? file.name : "Clique para escolher ou arraste o arquivo aqui"}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : "Formatos aceitos: .csv ou .xlsx · dados diários"}
              </p>
              <input
                id="file"
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </label>

            {error && <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="mt-6 flex justify-end">
              <button type="button" className="btn-primary min-w-[160px]" disabled={!file || loading} onClick={analyze}>
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Analisando...
                  </>
                ) : (
                  "Analisar"
                )}
              </button>
            </div>
          </>
        )}
      </section>

      {result && (
        <div className="mt-12">
          <AssetResults data={result} />
        </div>
      )}
    </div>
  );
}
