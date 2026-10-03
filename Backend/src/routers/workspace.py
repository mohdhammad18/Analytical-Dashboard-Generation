from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any

from src.services.history import history_service

router = APIRouter(prefix="/workspace", tags=["workspace"])


def _require_history():
    if not history_service.available:
        raise HTTPException(503, "History DB not configured")


class ChartCreate(BaseModel):
    title: str = "Untitled Chart"
    chart_config: Dict[str, Any]
    session_id: Optional[str] = None


class DashboardCreate(BaseModel):
    title: str = "Untitled Dashboard"
    dashboard_config: Dict[str, Any]
    session_id: Optional[str] = None


class PinUpdate(BaseModel):
    pinned: bool


@router.get("/charts")
async def list_charts():
    _require_history()
    return history_service.list_workspace_charts()


@router.post("/charts")
async def add_chart(body: ChartCreate):
    _require_history()
    return history_service.add_workspace_chart(
        chart_config=body.chart_config,
        title=body.title,
        session_id=body.session_id,
    )


@router.delete("/charts/{chart_id}")
async def delete_chart(chart_id: str):
    _require_history()
    history_service.delete_workspace_chart(chart_id)
    return {"status": "deleted"}


@router.patch("/charts/{chart_id}/pin")
async def pin_chart(chart_id: str, body: PinUpdate):
    _require_history()
    return history_service.toggle_pin_chart(chart_id, body.pinned)


# ── Dashboards ────────────────────────────────────────────────────────

@router.get("/dashboards")
async def list_dashboards():
    _require_history()
    return history_service.list_workspace_dashboards()


@router.post("/dashboards")
async def add_dashboard(body: DashboardCreate):
    _require_history()
    return history_service.add_workspace_dashboard(
        dashboard_config=body.dashboard_config,
        title=body.title,
        session_id=body.session_id,
    )


@router.delete("/dashboards/{dashboard_id}")
async def delete_dashboard(dashboard_id: str):
    _require_history()
    history_service.delete_workspace_dashboard(dashboard_id)
    return {"status": "deleted"}
