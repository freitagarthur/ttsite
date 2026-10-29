from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import AssetAnalysis, User
from app.schemas.auth import AnalysisHistoryItem
from app.services.asset_analysis import ALLOWED_EXTENSIONS, AnalysisError, run_asset_analysis

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.post("/asset")
async def analyze_asset(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filename = file.filename or "arquivo"
    if not any(filename.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS):
        raise HTTPException(400, "Formato inválido. Envie um arquivo .csv ou .xlsx.")
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"Arquivo muito grande (máximo {settings.MAX_UPLOAD_MB} MB).")
    try:
        result = await run_in_threadpool(run_asset_analysis, content, filename)
    except AnalysisError as exc:
        raise HTTPException(422, str(exc))

    record = AssetAnalysis(
        user_id=user.id,
        asset=result["descriptive"]["asset"],
        filename=filename,
        summary={"descriptive": result["descriptive"], "statistics": result["statistics"]},
    )
    db.add(record)
    await db.commit()
    result["id"] = record.id
    return result


@router.get("/history", response_model=list[AnalysisHistoryItem])
async def history(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = await db.scalars(
        select(AssetAnalysis)
        .where(AssetAnalysis.user_id == user.id)
        .order_by(AssetAnalysis.created_at.desc())
        .limit(50)
    )
    return list(rows)
