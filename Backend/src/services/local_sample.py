"""Local stand-in for the Supabase analytics tables.

Used when SUPABASE_URL / SUPABASE_KEY are not set, so the Overview screen
and InsightArc chart/dashboard actions still have the sample dataset to draw.
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any, Dict, List

_CSV = Path(__file__).resolve().parents[3] / "samples" / "monthly_video_conversion.csv"


def _split(total: int, weights: List[float]) -> List[int]:
    parts = [int(round(total * weight)) for weight in weights]
    parts[-1] = total - sum(parts[:-1])
    return parts


def _hms(count: int, minutes_each: int) -> str:
    total = max(count, 0) * minutes_each
    hours, minutes = divmod(total, 60)
    return f"{hours:02d}:{minutes:02d}:00"


def load_month_rows() -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with _CSV.open(newline="", encoding="utf-8") as handle:
        for record in csv.DictReader(handle):
            rows.append(
                {
                    "month": record["month"],
                    "total_uploaded": int(record["total_uploaded"]),
                    "total_created": int(record["total_created"]),
                    "total_published": int(record["total_published"]),
                }
            )
    return rows


def sample_tables() -> Dict[str, List[Dict[str, Any]]]:
    months = load_month_rows()
    uploaded = sum(row["total_uploaded"] for row in months)
    created = sum(row["total_created"] for row in months)
    published = sum(row["total_published"] for row in months)

    output_names = ["Full package", "Key moments", "Chapters"]
    output_weights = [0.38, 0.42, 0.20]
    output_uploaded = _split(uploaded, output_weights)
    output_created = _split(created, output_weights)
    output_published = _split(published, output_weights)
    output_type = []
    for name, up, cr, pub in zip(output_names, output_uploaded, output_created, output_published):
        output_type.append(
            {
                "output_type": name,
                "uploaded_count": up,
                "created_count": cr,
                "published_count": pub,
                "uploaded_duration": _hms(up, 18),
                "created_duration": _hms(cr, 2),
                "published_duration": _hms(pub, 3),
            }
        )

    input_names = ["News Bulletins", "Interviews", "Special Reports"]
    input_weights = [0.46, 0.34, 0.20]
    input_type = []
    for name, up, cr, pub in zip(
        input_names,
        _split(uploaded, input_weights),
        _split(created, input_weights),
        _split(published, input_weights),
    ):
        input_type.append(
            {
                "input_type": name,
                "uploaded_count": up,
                "created_count": cr,
                "published_count": pub,
                "uploaded_duration": _hms(up, 18),
                "created_duration": _hms(cr, 2),
                "published_duration": _hms(pub, 3),
            }
        )

    language_names = ["English", "Hindi"]
    language_weights = [0.62, 0.38]
    language = []
    for name, up, cr, pub in zip(
        language_names,
        _split(uploaded, language_weights),
        _split(created, language_weights),
        _split(published, language_weights),
    ):
        language.append(
            {
                "language": name,
                "uploaded_count": up,
                "created_count": cr,
                "published_count": pub,
                "uploaded_duration": _hms(up, 18),
                "created_duration": _hms(cr, 2),
                "published_duration": _hms(pub, 3),
            }
        )

    channel_names = ["YouTube", "Instagram", "Facebook", "X"]
    channel_weights = [0.48, 0.27, 0.15, 0.10]
    channel = []
    for name, up, cr, pub in zip(
        channel_names,
        _split(uploaded, channel_weights),
        _split(created, channel_weights),
        _split(published, channel_weights),
    ):
        channel.append(
            {
                "channel": name,
                "uploaded_count": up,
                "created_count": cr,
                "published_count": pub,
            }
        )

    user_names = ["Aarav Mehta", "Sara Iqbal", "Rohan Das", "Meera Nair", "Kabir Shah"]
    user_weights = [0.28, 0.22, 0.20, 0.18, 0.12]
    users = []
    for name, up, cr, pub in zip(
        user_names,
        _split(uploaded, user_weights),
        _split(created, user_weights),
        _split(published, user_weights),
    ):
        users.append(
            {
                "user": name,
                "uploaded_count": up,
                "created_count": cr,
                "published_count": pub,
            }
        )

    return {
        "month_wise_data": months,
        "output_type_data": output_type,
        "user_data": users,
        "channel_data": channel,
        "input_type_data": input_type,
        "language_data": language,
    }


def _line_chart(months: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "type": "line",
        "title": "Monthly Content Trends",
        "xAxisKey": "month",
        "data": months,
        "series": [
            {"key": "total_uploaded", "name": "Uploaded", "color": "#3b82f6"},
            {"key": "total_created", "name": "Created", "color": "#6366f1"},
            {"key": "total_published", "name": "Published", "color": "#10b981"},
        ],
    }


def demo_chat(text: str, *, make_chart: bool, make_dashboard: bool) -> Dict[str, Any]:
    """Answer Make Chart / Make Dashboard from the sample file, without an LLM."""
    months = load_month_rows()
    uploaded = sum(row["total_uploaded"] for row in months)
    created = sum(row["total_created"] for row in months)
    published = sum(row["total_published"] for row in months)
    rate = (published / created * 100) if created else 0
    chart = _line_chart(months)
    summary = (
        f"From Nov 2025 to Oct 2026 the newsroom uploaded {uploaded:,} long-form videos, "
        f"created {created:,} short clips, and published {published:,} of them "
        f"({rate:.2f}% of created clips). Counts climb into Sep 2026 and ease off in Oct 2026."
    )

    if make_dashboard:
        table_columns = ["month", "total_uploaded", "total_created", "total_published"]
        return {
            "reply": (
                "Created a dashboard titled **\"Monthly AI video conversion\"** with 6 panels. "
                "Open Workspace → Dashboards to see it."
            ),
            "table_data": months,
            "chart_config": None,
            "dashboard_config": {
                "title": "Monthly AI video conversion",
                "description": "Uploads, clips created, clips published, and the publish rate.",
                "panels": [
                    {
                        "id": "kpi-uploaded",
                        "panel_type": "kpi",
                        "title": "Total uploaded",
                        "status": "ok",
                        "layout": {"x": 0, "y": 0, "w": 3, "h": 1},
                        "kpi_value": f"{uploaded:,}",
                        "kpi_label": "Total uploaded",
                        "kpi_change": "+83%",
                        "kpi_trend": "up",
                    },
                    {
                        "id": "kpi-created",
                        "panel_type": "kpi",
                        "title": "Total created",
                        "status": "ok",
                        "layout": {"x": 3, "y": 0, "w": 3, "h": 1},
                        "kpi_value": f"{created:,}",
                        "kpi_label": "Total created",
                        "kpi_change": "+88%",
                        "kpi_trend": "up",
                    },
                    {
                        "id": "kpi-published",
                        "panel_type": "kpi",
                        "title": "Total published",
                        "status": "ok",
                        "layout": {"x": 6, "y": 0, "w": 3, "h": 1},
                        "kpi_value": f"{published:,}",
                        "kpi_label": "Total published",
                        "kpi_change": "+93%",
                        "kpi_trend": "up",
                    },
                    {
                        "id": "kpi-rate",
                        "panel_type": "kpi",
                        "title": "Conversion rate",
                        "status": "ok",
                        "layout": {"x": 9, "y": 0, "w": 3, "h": 1},
                        "kpi_value": f"{rate:.2f}%",
                        "kpi_label": "Published / created",
                        "kpi_change": "+0.4%",
                        "kpi_trend": "up",
                    },
                    {
                        "id": "chart-monthly",
                        "panel_type": "chart",
                        "title": "Monthly trend",
                        "status": "ok",
                        "layout": {"x": 0, "y": 1, "w": 12, "h": 2},
                        "chart_config": chart,
                    },
                    {
                        "id": "table-months",
                        "panel_type": "table",
                        "title": "All 12 months",
                        "status": "ok",
                        "layout": {"x": 0, "y": 3, "w": 12, "h": 3},
                        "table_columns": table_columns,
                        "table_data": months,
                    },
                ],
            },
        }

    if make_chart:
        return {
            "reply": summary + " The line chart is on Workspace → Charts.",
            "table_data": months,
            "chart_config": chart,
            "dashboard_config": None,
        }

    return {
        "reply": summary,
        "table_data": months,
        "chart_config": None,
        "dashboard_config": None,
    }
