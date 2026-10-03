import logging
from typing import List, Dict, Any
from dataclasses import asdict

from .executor import ResolvedPanel

logger = logging.getLogger(__name__)


def compose_layout(
    resolved_panels: List[ResolvedPanel],
    dashboard_title: str,
    dashboard_description: str,
) -> Dict[str, Any]:
    """
    Assign grid layout to resolved panels and build the final DashboardConfig.
    Uses deterministic layout rules (no LLM) to avoid unnecessary latency.
    """
    logger.info(
        "compose_layout | title=%r panels=%d",
        dashboard_title, len(resolved_panels),
    )
    layout = _compute_deterministic_layout(resolved_panels)

    panels_out = []
    layout_map = {item["id"]: item for item in layout}

    for panel in resolved_panels:
        panel_dict = asdict(panel)
        panel_dict["layout"] = layout_map.get(panel.id, {"x": 0, "y": 0, "w": 12, "h": 2})
        panels_out.append(panel_dict)

    config = {
        "title": dashboard_title,
        "description": dashboard_description,
        "panels": panels_out,
    }
    logger.info("compose_layout done | panels_out=%d", len(panels_out))
    return config


def _compute_deterministic_layout(panels: List[ResolvedPanel]) -> List[Dict[str, Any]]:
    """Deterministic layout: KPIs in top row, charts 2-per-row, tables full-width."""
    kpis = [p for p in panels if p.panel_type == "kpi"]
    charts = [p for p in panels if p.panel_type == "chart"]
    tables = [p for p in panels if p.panel_type == "table"]

    layout = []
    current_y = 0

    # KPI row(s): w=3, h=1, 4 per row
    if kpis:
        x = 0
        for kpi in kpis:
            if x >= 12:
                x = 0
                current_y += 1
            w = max(3, 12 // len(kpis)) if len(kpis) <= 4 else 3
            layout.append({"id": kpi.id, "x": x, "y": current_y, "w": w, "h": 1})
            x += w
        current_y += 1

    # Chart rows: w=6, h=2, 2 per row
    if charts:
        x = 0
        for chart in charts:
            if x >= 12:
                x = 0
                current_y += 2
            layout.append({"id": chart.id, "x": x, "y": current_y, "w": 6, "h": 2})
            x += 6
        current_y += 2

    # Table rows: w=12, h=2
    for table in tables:
        layout.append({"id": table.id, "x": 0, "y": current_y, "w": 12, "h": 2})
        current_y += 2

    return layout
