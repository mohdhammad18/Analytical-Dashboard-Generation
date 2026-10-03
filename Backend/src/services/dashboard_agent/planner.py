import json
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from src.core.llm import llm_invoke
from src.services.text_to_sql_agent.utils import get_supabase_client

logger = logging.getLogger(__name__)

PLANNER_SYSTEM_PROMPT = """You are a dashboard planning expert for a data analytics platform.

Given a user's request and the available database tables, decompose their request into 4-8 individual data panels that together form a comprehensive dashboard.

### Available Tables
{tables_metadata}

### Panel Types
- "kpi": A single headline metric (e.g. total count, average, percentage). The SQL should return exactly ONE row with 1-2 columns: the metric value, and optionally a comparison value for calculating change.
- "chart": A visualization (bar, line, area, pie). The SQL should return multiple rows suitable for plotting.
- "table": A data table showing detailed rows.

### Output Format
Return a JSON object with this EXACT schema:
{{
  "title": "<dashboard title>",
  "description": "<1-sentence dashboard description>",
  "panels": [
    {{
      "id": "panel_1",
      "query": "<natural language question that text-to-SQL can answer>",
      "panel_type": "kpi" | "chart" | "table",
      "title": "<short panel title>",
      "chart_hint": "bar" | "line" | "pie" | "area" | null
    }}
  ]
}}

### Rules
1. Create 4-8 panels. Start with 2-3 KPI cards for headline numbers, then add 2-4 charts, and optionally 1 table.
2. Each panel's "query" must be a self-contained natural language question that can be independently answered by querying the database. Be specific — reference actual table concepts from the metadata.
3. For KPI panels, the query should ask for a single aggregate value (e.g. "What is the total number of videos created?").
4. For chart panels, include a "chart_hint" suggesting the best chart type. Use "line" for time series, "bar" for category comparisons, "pie" for proportions, "area" for cumulative trends.
5. For table panels, the query should ask for a detailed listing with a reasonable LIMIT (5-10 rows).
6. Make panels diverse — don't repeat the same metric in different forms.
7. panel IDs must be unique: panel_1, panel_2, etc.

Output raw JSON ONLY. No markdown, no explanation."""


@dataclass
class PanelSpec:
    id: str
    query: str
    panel_type: str
    title: str
    chart_hint: Optional[str] = None


def _load_all_table_metadata() -> List[Dict[str, Any]]:
    logger.debug("Loading table metadata from Supabase")
    client = get_supabase_client()
    response = client.table("table_metadata").select("table_name, table_description, data_description").execute()
    logger.debug("Loaded %d table metadata rows", len(response.data))
    return response.data


def plan_dashboard(prompt: str) -> Dict[str, Any]:
    """
    Decompose a user prompt into a dashboard plan with multiple PanelSpecs.
    Uses the active LLM provider (Groq or OpenAI) via the shared factory.
    """
    logger.info("plan_dashboard | prompt_preview=%.100r", prompt)

    tables = _load_all_table_metadata()
    tables_str = json.dumps(tables, indent=2)
    system = PLANNER_SYSTEM_PROMPT.format(tables_metadata=tables_str)

    raw = llm_invoke(
        system=system,
        user=prompt,
        json_mode=True,
        temperature=0.0,
    )
    plan = json.loads(raw)

    panels = [
        PanelSpec(
            id=p["id"],
            query=p["query"],
            panel_type=p["panel_type"],
            title=p["title"],
            chart_hint=p.get("chart_hint"),
        )
        for p in plan.get("panels", [])
    ]

    logger.info(
        "plan_dashboard done | title=%r panels=%d",
        plan.get("title"), len(panels),
    )
    return {
        "title": plan.get("title", "Dashboard"),
        "description": plan.get("description", ""),
        "panels": panels,
    }
