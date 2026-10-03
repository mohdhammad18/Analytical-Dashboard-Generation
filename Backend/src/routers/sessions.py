from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from src.services.history import history_service

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _require_history():
    if not history_service.available:
        raise HTTPException(503, "History DB not configured")


class SessionCreate(BaseModel):
    title: str = "New Chat"


class SessionUpdate(BaseModel):
    title: str


# ── Session CRUD ─────────────────────────────────────────────────────

@router.get("/")
async def list_sessions():
    _require_history()
    return history_service.list_sessions()


@router.post("/")
async def create_session(body: SessionCreate):
    _require_history()
    session = history_service.create_session(title=body.title)
    history_service.update_preferences(active_session_id=session["id"])
    return session


@router.get("/{session_id}")
async def get_session(session_id: str):
    _require_history()
    session = history_service.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session


@router.patch("/{session_id}")
async def update_session(session_id: str, body: SessionUpdate):
    _require_history()
    return history_service.update_session(session_id, body.title)


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    _require_history()
    history_service.delete_session(session_id)
    return {"status": "deleted"}


# ── Messages for a session ───────────────────────────────────────────

@router.get("/{session_id}/messages")
async def get_messages(session_id: str):
    _require_history()
    return history_service.get_messages(session_id)
