"""Worker Celery: processa análises pesadas em segundo plano (base para as próximas fases)."""
import base64

from celery import Celery

from app.core.config import settings
from app.services.asset_analysis import run_asset_analysis

celery_app = Celery("tradetutor", broker=settings.REDIS_URL, backend=settings.REDIS_URL)
celery_app.conf.update(task_serializer="json", result_serializer="json", result_expires=3600)


@celery_app.task(name="analysis.asset")
def asset_analysis_task(content_b64: str, filename: str) -> dict:
    return run_asset_analysis(base64.b64decode(content_b64), filename)
