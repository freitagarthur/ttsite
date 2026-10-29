"""Leitura, validação e análise estatística de séries diárias OHLC."""
from __future__ import annotations

import io
import logging
import math
import re
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import pearsonr

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".csv", ".xlsx"}
SMA_PERIODS = (9, 21, 200)
RSI_PERIOD = 14

# Aliases aceitos para cada coluna obrigatória (após normalização: minúsculas, sem acento)
COLUMN_ALIASES = {
    "date": {"data", "date", "datetime", "time", "dia", "timestamp", "data/hora"},
    "open": {"open", "abertura", "abert", "o"},
    "high": {"high", "maxima", "max", "alta", "h"},
    "low": {"low", "minima", "min", "baixa", "l"},
    "close": {"close", "fechamento", "fech", "ultimo", "c", "adj close"},
}


class AnalysisError(ValueError):
    """Erro de validação com mensagem amigável para o usuário."""


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode()
    return text.strip().lower()


def asset_name_from_filename(filename: str) -> str:
    stem = Path(filename).stem
    stem = re.sub(r"[_\-]+", " ", stem).strip()
    return stem.upper() or "ATIVO"


def _to_number(series: pd.Series) -> pd.Series:
    """Converte números, aceitando formato brasileiro (1.234,56)."""
    if pd.api.types.is_numeric_dtype(series):
        return series.astype(float)
    s = series.astype(str).str.strip().str.replace(r"[^\d,.\-eE]", "", regex=True)
    has_comma = s.str.contains(",", regex=False)
    s = s.where(~has_comma, s.str.replace(".", "", regex=False).str.replace(",", ".", regex=False))
    return pd.to_numeric(s, errors="coerce")


def _parse_dates(series: pd.Series) -> pd.Series:
    if pd.api.types.is_datetime64_any_dtype(series):
        return series
    sample = series.dropna().astype(str).head(20)
    iso = sample.str.match(r"^\d{4}-\d{1,2}-\d{1,2}").all()
    return pd.to_datetime(series, errors="coerce", dayfirst=not iso)


def read_file(content: bytes, filename: str) -> pd.DataFrame:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise AnalysisError("Formato inválido. Envie um arquivo .csv ou .xlsx.")
    if not content:
        raise AnalysisError("O arquivo enviado está vazio.")
    try:
        if ext == ".csv":
            text = None
            for enc in ("utf-8-sig", "latin-1"):
                try:
                    text = content.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue
            df = pd.read_csv(io.StringIO(text), sep=None, engine="python")
        else:
            df = pd.read_excel(io.BytesIO(content), engine="openpyxl")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Falha ao ler arquivo %s: %s", filename, exc)
        raise AnalysisError("Não foi possível ler o arquivo. Verifique se ele não está corrompido.")
    if df.empty:
        raise AnalysisError("O arquivo não contém dados.")
    return df


def select_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Mantém apenas data, open, high, low, close (descarta demais colunas)."""
    mapping: dict[str, str] = {}
    for col in df.columns:
        norm = _normalize(col)
        for target, aliases in COLUMN_ALIASES.items():
            if target not in mapping.values() and norm in aliases:
                mapping[col] = target
                break
    missing = [c for c in COLUMN_ALIASES if c not in mapping.values()]
    if missing:
        nomes = {"date": "data", "open": "open", "high": "high", "low": "low", "close": "close"}
        raise AnalysisError(
            "Colunas obrigatórias ausentes: "
            + ", ".join(nomes[m] for m in missing)
            + ". O arquivo deve conter as colunas data, open, high, low, close."
        )
    out = df[list(mapping.keys())].rename(columns=mapping)
    out["date"] = _parse_dates(out["date"])
    for c in ("open", "high", "low", "close"):
        out[c] = _to_number(out[c])
    out = out.dropna().sort_values("date")
    if out.empty:
        raise AnalysisError("Não foram encontradas linhas válidas (datas ou preços inválidos).")
    return out.reset_index(drop=True)


def ensure_daily(df: pd.DataFrame) -> pd.DataFrame:
    """Rejeita dados intraday (hora/minuto) ou de periodicidade maior que diária."""
    dates = df["date"]
    intraday_msg = (
        "Os dados enviados não são diários (foram detectados registros de hora ou minuto). "
        "Por favor, envie um arquivo com dados diários."
    )
    if dates.dt.normalize().duplicated().any():
        raise AnalysisError(intraday_msg)
    if len(df) >= 3:
        median_gap = dates.diff().dropna().median()
        if median_gap < pd.Timedelta(hours=20):
            raise AnalysisError(intraday_msg)
        if median_gap > pd.Timedelta(days=4):
            raise AnalysisError(
                "Os dados parecem ser semanais ou mensais. Por favor, envie um arquivo com dados diários."
            )
    df = df.copy()
    df["date"] = dates.dt.normalize()
    return df


def compute_rsi(close: pd.Series, period: int = RSI_PERIOD) -> pd.Series:
    """IFR de Wilder."""
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - 100 / (1 + rs)
    rsi = rsi.where(avg_loss != 0, 100.0)
    rsi.iloc[:period] = np.nan
    return rsi


def _f(value, ndigits: int = 4):
    """Converte para float JSON-safe (NaN/inf -> None)."""
    if value is None:
        return None
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(v) or math.isinf(v):
        return None
    return round(v, ndigits)


def fetch_ibov_returns(start: pd.Timestamp, end: pd.Timestamp) -> pd.Series | None:
    try:
        import yfinance as yf

        data = yf.download(
            "^BVSP",
            start=(start - pd.Timedelta(days=5)).strftime("%Y-%m-%d"),
            end=(end + pd.Timedelta(days=2)).strftime("%Y-%m-%d"),
            interval="1d",
            progress=False,
            auto_adjust=False,
        )
        if data is None or data.empty:
            return None
        close = data["Close"]
        if isinstance(close, pd.DataFrame):
            close = close.iloc[:, 0]
        close.index = pd.to_datetime(close.index).tz_localize(None).normalize()
        return close.pct_change().dropna()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Falha ao obter dados do IBOV: %s", exc)
        return None


def ibov_correlation(df: pd.DataFrame, ibov_returns: pd.Series | None) -> dict:
    if ibov_returns is None:
        return {"value": None, "days": 0, "message": "Não foi possível obter os dados do IBOV no momento."}
    asset_ret = df.set_index("date")["close"].pct_change().dropna()
    joined = pd.concat([asset_ret, ibov_returns], axis=1, join="inner").dropna()
    if len(joined) < 20:
        return {
            "value": None,
            "days": int(len(joined)),
            "message": "Poucos dias em comum com o IBOV para calcular a correlação (mínimo 20).",
        }
    r, p = pearsonr(joined.iloc[:, 0], joined.iloc[:, 1])
    return {"value": _f(r), "p_value": _f(p, 6), "days": int(len(joined)), "message": None}


def analyze(df: pd.DataFrame, asset: str, ibov_returns: pd.Series | None = "fetch") -> dict:
    n = len(df)
    if n < 2:
        raise AnalysisError("São necessários pelo menos 2 dias de dados para a análise.")
    close, high, low, open_ = df["close"], df["high"], df["low"], df["open"]
    warnings: list[str] = []

    # Variação diária (fechamento contra fechamento anterior)
    ret = close.pct_change() * 100
    abs_ret = ret.abs()

    # Médias móveis aritméticas e distâncias percentuais
    smas = {}
    sma_stats = {}
    for p in SMA_PERIODS:
        sma = close.rolling(p).mean()
        smas[p] = sma
        dist = ((close - sma) / sma * 100).abs()
        if sma.notna().any():
            sma_stats[str(p)] = {
                "current_value": _f(sma.iloc[-1]),
                "current_distance_pct": _f(dist.iloc[-1]),
                "mean_distance_pct": _f(dist.mean()),
                "max_distance_pct": _f(dist.max()),
            }
        else:
            sma_stats[str(p)] = None
            warnings.append(f"Dados insuficientes para a MMA {p} (necessário ao menos {p} dias).")

    # Gaps: abertura acima da máxima anterior ou abaixo da mínima anterior
    gap_up = open_ > high.shift(1)
    gap_down = open_ < low.shift(1)
    comparable_days = n - 1
    gaps_total = int(gap_up.sum() + gap_down.sum())

    # Máxima / fechamento atuais frente à MMA 200
    sma200 = smas[200]
    last_sma200 = sma200.iloc[-1]
    high_vs_sma200 = abs((high.iloc[-1] - last_sma200) / last_sma200 * 100) if pd.notna(last_sma200) else None
    close_vs_sma200 = abs((close.iloc[-1] - last_sma200) / last_sma200 * 100) if pd.notna(last_sma200) else None

    rsi = compute_rsi(close)
    if rsi.notna().sum() == 0:
        warnings.append("Dados insuficientes para o IFR 14.")

    if isinstance(ibov_returns, str):
        ibov_returns = fetch_ibov_returns(df["date"].iloc[0], df["date"].iloc[-1])
    corr = ibov_correlation(df, ibov_returns)
    if corr["value"] is None and corr.get("message"):
        warnings.append(corr["message"])

    max_up_idx = ret.idxmax() if ret.notna().any() else None
    max_down_idx = ret.idxmin() if ret.notna().any() else None

    def _series(s: pd.Series) -> list[dict]:
        return [
            {"time": d.strftime("%Y-%m-%d"), "value": round(float(v), 4)}
            for d, v in zip(df["date"], s)
            if pd.notna(v)
        ]

    return {
        "descriptive": {
            "asset": asset,
            "days": n,
            "start_date": df["date"].iloc[0].strftime("%Y-%m-%d"),
            "end_date": df["date"].iloc[-1].strftime("%Y-%m-%d"),
            "last_close": _f(close.iloc[-1]),
        },
        "statistics": {
            "mean_daily_change_pct": _f(ret.mean()),
            "mean_abs_daily_change_pct": _f(abs_ret.mean()),
            "max_daily_change_pct": _f(abs_ret.max()),
            "max_daily_gain_pct": _f(ret.max()),
            "max_daily_gain_date": df["date"].iloc[max_up_idx].strftime("%Y-%m-%d") if max_up_idx is not None else None,
            "max_daily_loss_pct": _f(ret.min()),
            "max_daily_loss_date": df["date"].iloc[max_down_idx].strftime("%Y-%m-%d") if max_down_idx is not None else None,
            "std_daily_change_pct": _f(ret.std()),
            "sma": sma_stats,
            "gaps": {
                "total": gaps_total,
                "up": int(gap_up.sum()),
                "down": int(gap_down.sum()),
                "days_compared": comparable_days,
                "frequency_pct": _f(gaps_total / comparable_days * 100) if comparable_days else None,
            },
            "last_high_vs_sma200_pct": _f(high_vs_sma200),
            "last_close_vs_sma200_pct": _f(close_vs_sma200),
            "rsi14": _f(rsi.iloc[-1], 2),
            "ibov_correlation": corr,
        },
        "chart": {
            "candles": [
                {
                    "time": d.strftime("%Y-%m-%d"),
                    "open": float(o),
                    "high": float(h),
                    "low": float(l),
                    "close": float(c),
                }
                for d, o, h, l, c in zip(df["date"], open_, high, low, close)
            ],
            "sma9": _series(smas[9]),
            "sma21": _series(smas[21]),
            "sma200": _series(smas[200]),
            "rsi14": _series(rsi),
        },
        "warnings": warnings,
    }


def run_asset_analysis(content: bytes, filename: str, ibov_returns="fetch") -> dict:
    raw = read_file(content, filename)
    df = ensure_daily(select_columns(raw))
    return analyze(df, asset_name_from_filename(filename), ibov_returns)
