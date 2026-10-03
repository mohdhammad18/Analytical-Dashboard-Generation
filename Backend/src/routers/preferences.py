from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from src.services.history import history_service

router = APIRouter(prefix="/preferences", tags=["preferences"])


def _require_history():
    if not history_service.available:
        raise HTTPException(503, "History DB not configured")


class PreferencesUpdate(BaseModel):
    active_session_id: Optional[str] = None
    make_chart_default: Optional[bool] = None
    chat_panel_width: Optional[int] = None


@router.get("/")
async def get_preferences():
    _require_history()
    return history_service.get_preferences()


@router.patch("/")
async def update_preferences(body: PreferencesUpdate):
    _require_history()
    kwargs = {k: v for k, v in body.model_dump().items() if v is not None}
    return history_service.update_preferences(**kwargs)
