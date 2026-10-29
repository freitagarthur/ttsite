"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/Providers";

function Callback() {
  const params = useSearchParams();
  const router = useRouter();
  const { login } = useApp();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get("token");
    const err = params.get("error");
    if (token) {
      login(token).then(() => router.replace("/analise-ativo"));
    } else {
      setError(err || "Não foi possível concluir o login.");
    }
  }, [params, login, router]);

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      {error ? (
        <>
          <p className="text-red-500">{error}</p>
          <Link href="/login" className="btn-primary mt-6">Voltar ao login</Link>
        </>
      ) : (
        <p className="text-slate-500">Concluindo login...</p>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<p className="py-24 text-center text-slate-500">Carregando...</p>}>
      <Callback />
    </Suspense>
  );
}
