import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, as_completed

from src.services.text_to_sql_agent import run_pipeline
from src.services.chart_agent import chart_agent
from .planner import PanelSpec

logger = logging.getLogger(__name__)

MAX_WORKERS = 4


@dataclass
class ResolvedPanel:
    id: str
    panel_type: str
    title: str
    status: str = "ok"
    error: Optional[str] = None
    # chart fields
    chart_config: Optional[Dict[str, Any]] = None
    # kpi fields
    kpi_value: Optional[Any] = None
    kpi_label: Optional[str] = None
    kpi_change: Optional[str] = None
    kpi_trend: Optional[str] = None
    # table fields
    table_data: Optional[List[Dict[str, Any]]] = None
    table_columns: Optional[List[str]] = None


def _resolve_single_panel(spec: PanelSpec) -> ResolvedPanel:
    """Resolve one PanelSpec by running text2sql and optional chart generation."""
    panel = ResolvedPanel(id=spec.id, panel_type=spec.panel_type, title=spec.title)
    logger.info("Resolving panel '%s' (type=%s) | query=%.80r", spec.id, spec.panel_type, spec.query)

    try:
        result = run_pipeline(spec.query)

        sql_error = result.get("error")
        rows = result.get("results")

        if sql_error or not rows:
            logger.warning("Panel '%s' SQL failed | error=%s", spec.id, sql_error or "no results")
            panel.status = "error"
            panel.error = sql_error or "No results returned"
            return panel

        logger.debug("Panel '%s' SQL ok | rows=%d", spec.id, len(rows))

        if spec.panel_type == "kpi":
            panel = _build_kpi(panel, rows)
        elif spec.panel_type == "chart":
            panel = _build_chart(panel, spec, rows)
        elif spec.panel_type == "table":
            panel = _build_table(panel, rows)

    except Exception as e:
        logger.error("Panel '%s' raised an exception: %s", spec.id, e, exc_info=True)
        panel.status = "error"
        panel.error = str(e)

    return panel


def _build_kpi(panel: ResolvedPanel, rows: List[Dict[str, Any]]) -> ResolvedPanel:
    """Extract a single KPI value from the first row of results."""
    first_row = rows[0]
    columns = list(first_row.keys())

    value = first_row[columns[0]]
    panel.kpi_value = _format_kpi_value(value)
    panel.kpi_label = columns[0].replace("_", " ").title()

    if len(columns) >= 2:
        second_val = first_row[columns[1]]
        try:
            change_num = float(second_val)
            panel.kpi_change = f"{change_num:+.1f}%"
            panel.kpi_trend = "up" if change_num > 0 else ("down" if change_num < 0 else "neutral")
        except (TypeError, ValueError):
            panel.kpi_change = str(second_val)
            panel.kpi_trend = "neutral"

    logger.debug("KPI panel '%s' | value=%s label=%s", panel.id, panel.kpi_value, panel.kpi_label)
    return panel


def _build_chart(panel: ResolvedPanel, spec: PanelSpec, rows: List[Dict[str, Any]]) -> ResolvedPanel:
    """Generate a ChartConfig using the existing chart_agent."""
    try:
        config = chart_agent.generate(query=spec.query, table_data=rows)
        if spec.chart_hint and spec.chart_hint in ("bar", "line", "pie", "area"):
            config["type"] = spec.chart_hint
        panel.chart_config = config
        logger.debug("Chart panel '%s' | type=%s", panel.id, config.get("type"))
    except Exception as e:
        logger.warning("ChartAgent failed for panel '%s', falling back to table: %s", spec.id, e)
        panel = _build_table(panel, rows)
        panel.panel_type = "table"
    return panel


def _build_table(panel: ResolvedPanel, rows: List[Dict[str, Any]]) -> ResolvedPanel:
    """Pass through raw data as a table."""
    panel.table_data = rows[:20]
    panel.table_columns = list(rows[0].keys()) if rows else []
    logger.debug("Table panel '%s' | rows=%d", panel.id, len(panel.table_data))
    return panel


def _format_kpi_value(value: Any) -> str:
    """Format a KPI value for display."""
    if isinstance(value, float):
        if abs(value) >= 1_000_000:
            return f"{value / 1_000_000:.1f}M"
        if abs(value) >= 1_000:
            return f"{value / 1_000:.1f}K"
        return f"{value:,.2f}"
    if isinstance(value, int):
        if abs(value) >= 1_000_000:
            return f"{value / 1_000_000:.1f}M"
        if abs(value) >= 1_000:
            return f"{value / 1_000:.1f}K"
        return f"{value:,}"
    return str(value)


def execute_panels(panel_specs: List[PanelSpec]) -> List[ResolvedPanel]:
    """Execute all panel specs in parallel and return resolved panels."""
    logger.info("execute_panels | total=%d workers=%d", len(panel_specs), MAX_WORKERS)
    resolved: List[ResolvedPanel] = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        future_to_spec = {
            pool.submit(_resolve_single_panel, spec): spec
            for spec in panel_specs
        }
        for future in as_completed(future_to_spec):
            spec = future_to_spec[future]
            try:
                panel = future.result()
                resolved.append(panel)
                logger.debug("Panel '%s' completed | status=%s", panel.id, panel.status)
            except Exception as e:
                logger.error("Unexpected error for panel '%s': %s", spec.id, e, exc_info=True)
                resolved.append(ResolvedPanel(
                    id=spec.id,
                    panel_type=spec.panel_type,
                    title=spec.title,
                    status="error",
                    error=str(e),
                ))

    resolved.sort(key=lambda p: p.id)
    logger.info(
        "execute_panels done | ok=%d error=%d",
        sum(1 for p in resolved if p.status == "ok"),
        sum(1 for p in resolved if p.status == "error"),
    )
    return resolved
