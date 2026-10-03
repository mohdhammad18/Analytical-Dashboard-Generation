import json
import logging
from typing import List, Dict, Any

from src.core.llm import llm_invoke

logger = logging.getLogger(__name__)

CHART_SYSTEM_PROMPT = """You are a data visualization expert. Your job is to analyze SQL query results and produce a JSON configuration for a Recharts chart that best represents the data.

You MUST output a single JSON object with this EXACT schema:
{
  "type": "bar" | "line" | "pie" | "area",
  "title": "<short descriptive chart title>",
  "xAxisKey": "<the key in each data row to use as the X-axis / category label>",
  "series": [
    {
      "key": "<column name from the data to plot as a numeric value>",
      "name": "<human-readable label for this series>",
      "color": "<hex color, e.g. #6366f1>"
    }
  ],
  "data": [<the rows of data to chart, each row is an object>]
}

### Rules:
1. Pick the chart type that best fits the data:
   - "bar" for comparing categories or discrete groups
   - "line" for trends over time or ordered sequences
   - "area" for trends where you want to emphasize volume/magnitude
   - "pie" for showing proportions of a whole (only when there is ONE numeric series and a small number of categories, ideally <= 8)
2. "xAxisKey" must be a key present in every data row. It is usually a categorical or time-based column (e.g. month, user, channel, output_type).
3. Each entry in "series" must reference a numeric column in the data rows via "key".
4. Use distinct, visually appealing hex colors for each series. Good palette: #6366f1, #3b82f6, #10b981, #f59e0b, #ef4444, #8b5cf6, #ec4899, #14b8a6.
5. "data" must contain the actual row objects. Clean up the data: remove internal IDs or irrelevant columns. Keep only the xAxisKey column and the numeric series columns. Round floats to 2 decimal places.
6. "title" should be concise and describe what the chart shows.
7. If the data has too many rows (>30) for a bar/pie chart, consider summarizing or truncating. For line/area charts, more rows are fine.
8. Output raw JSON ONLY. No markdown, no explanation, no extra keys."""


class ChartAgent:
    """Converts SQL result rows into a Recharts-compatible ChartConfig JSON."""

    def generate(self, query: str, table_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not table_data:
            logger.error("ChartAgent.generate called with empty table_data")
            raise ValueError("No data provided to chart agent")

        columns = list(table_data[0].keys())
        logger.info(
            "ChartAgent.generate | rows=%d columns=%s query_preview=%.80r",
            len(table_data), columns, query,
        )

        sample = table_data[:5]
        user_prompt = (
            f"User's question: {query}\n\n"
            f"SQL result columns: {columns}\n"
            f"Total rows: {len(table_data)}\n"
            f"Sample rows (first 5):\n{json.dumps(sample, indent=2, default=str)}\n\n"
            f"Full data ({len(table_data)} rows):\n{json.dumps(table_data, default=str)}\n\n"
            "Produce the ChartConfig JSON."
        )

        raw = llm_invoke(
            system=CHART_SYSTEM_PROMPT,
            user=user_prompt,
            json_mode=True,
            temperature=0.0,
        )

        config = json.loads(raw)
        self._validate(config)
        logger.info("ChartAgent.generate success | type=%s title=%r", config.get("type"), config.get("title"))
        return config

    @staticmethod
    def _validate(config: Dict[str, Any]) -> None:
        required = {"type", "title", "xAxisKey", "series", "data"}
        missing = required - set(config.keys())
        if missing:
            raise ValueError(f"Chart config missing keys: {missing}")
        if config["type"] not in ("bar", "line", "pie", "area"):
            raise ValueError(f"Invalid chart type: {config['type']}")
        if not isinstance(config["series"], list) or len(config["series"]) == 0:
            raise ValueError("Chart config must have at least one series")
        if not isinstance(config["data"], list) or len(config["data"]) == 0:
            raise ValueError("Chart config must have non-empty data")


chart_agent = ChartAgent()
