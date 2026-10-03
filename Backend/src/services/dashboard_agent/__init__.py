import logging
from typing import Dict, Any

from .planner import plan_dashboard, PanelSpec
from .executor import execute_panels, ResolvedPanel
from .composer import compose_layout

logger = logging.getLogger(__name__)


def generate_dashboard(prompt: str) -> Dict[str, Any]:
    """
    End-to-end dashboard generation pipeline:
      1. Plan — decompose user prompt into panel specs
      2. Execute — run text2sql + chart/kpi/table generation in parallel
      3. Compose — assign grid layout and build final DashboardConfig
    """
    logger.info("DashboardAgent step 1/3: planning panels")
    plan = plan_dashboard(prompt)

    panel_specs = plan["panels"]
    logger.info("DashboardAgent planned %d panels: %s", len(panel_specs), [s.id for s in panel_specs])

    logger.info("DashboardAgent step 2/3: executing panels in parallel")
    resolved = execute_panels(panel_specs)

    ok_count = sum(1 for p in resolved if p.status == "ok")
    logger.info("DashboardAgent resolved %d/%d panels successfully", ok_count, len(resolved))

    logger.info("DashboardAgent step 3/3: composing layout")
    successful_panels = [p for p in resolved if p.status == "ok"]

    if not successful_panels:
        return {
            "title": plan["title"],
            "description": plan["description"],
            "panels": [],
            "error": "All panels failed to resolve. Try rephrasing your dashboard request.",
        }

    dashboard_config = compose_layout(
        resolved_panels=successful_panels,
        dashboard_title=plan["title"],
        dashboard_description=plan["description"],
    )

    logger.info(
        "DashboardAgent done | title=%r panels=%d",
        dashboard_config.get("title"),
        len(dashboard_config.get("panels", [])),
    )
    return dashboard_config


__all__ = ["generate_dashboard", "PanelSpec", "ResolvedPanel"]
