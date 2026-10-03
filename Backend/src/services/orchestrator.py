import json
import logging
from typing import List, Dict, Any, Optional

from src.core.llm import llm_invoke, llm_chat
from src.services.text_to_sql_agent import run_pipeline
from src.services.chart_agent import chart_agent
from src.services.dashboard_agent import generate_dashboard

logger = logging.getLogger(__name__)

CLASSIFIER_SYSTEM_PROMPT = """You are a query classifier for a data analytics platform.
Given a user message and conversation history, decide whether the user's request requires querying a database (SQL) to answer, or if it can be answered conversationally.

Examples that NEED SQL:
- "Show me monthly trends"
- "What are the top 5 users by uploads?"
- "How many videos were created last month?"
- "Compare channel A vs channel B"
- Any request for specific numbers, rankings, aggregations, or data lookups

Examples that DO NOT need SQL:
- "Hello"
- "What can you do?"
- "Explain what conversion rate means"
- "Thanks!"
- General knowledge questions unrelated to the database

Return a JSON object: {"needs_sql": true} or {"needs_sql": false}
Output raw JSON ONLY."""

CHAT_SYSTEM_PROMPT = "You are a helpful, knowledgeable, and concise AI assistant."


def classify_query(text: str, messages: List[dict]) -> bool:
    recent = messages[-4:] if len(messages) > 4 else messages
    conversation = "\n".join(f"{m['role']}: {m['content']}" for m in recent)
    conversation += f"\nuser: {text}"

    raw = llm_invoke(
        system=CLASSIFIER_SYSTEM_PROMPT,
        user=conversation,
        json_mode=True,
        temperature=0.0,
    )
    return json.loads(raw).get("needs_sql", False)


def orchestrate(
    messages: List[dict],
    text: str,
    make_chart: bool = False,
    make_dashboard: bool = False,
) -> Dict[str, Any]:
    """
    Main orchestration flow:
    1. If make_dashboard: run full dashboard generation pipeline
    2. Otherwise classify the query (needs SQL or not)
    3. If SQL needed: run text2sql pipeline
    4. If make_chart and results exist: run chart_agent
    5. Build and return the combined response
    """
    if make_dashboard:
        logger.info("orchestrate | mode=dashboard prompt_preview=%.80r", text)
        try:
            dashboard_config = generate_dashboard(text)
            panel_count = len(dashboard_config.get("panels", []))
            logger.info("Dashboard generated | title=%r panels=%d", dashboard_config.get("title"), panel_count)
            reply = (
                f"I've created a dashboard titled **\"{dashboard_config.get('title', 'Dashboard')}\"** "
                f"with {panel_count} panel{'s' if panel_count != 1 else ''}. "
                f"Check the Workspace Dashboards tab to view it."
            )
            return {
                "reply": reply,
                "table_data": None,
                "chart_config": None,
                "dashboard_config": dashboard_config,
            }
        except Exception as e:
            logger.error("Dashboard generation failed: %s", e, exc_info=True)
            reply = llm_chat(
                system=CHAT_SYSTEM_PROMPT,
                history=messages,
                user_text=(
                    f"The user asked me to create a dashboard: {text}\n\n"
                    f"But the dashboard generation failed with: {e}\n\n"
                    "Please apologize and suggest they rephrase or simplify their request."
                ),
            )
            return {"reply": reply, "table_data": None, "chart_config": None, "dashboard_config": None}

    needs_sql = classify_query(text, messages)
    logger.info("orchestrate | mode=chat needs_sql=%s make_chart=%s", needs_sql, make_chart)

    if not needs_sql:
        reply = llm_chat(system=CHAT_SYSTEM_PROMPT, history=messages, user_text=text)
        return {"reply": reply, "table_data": None, "chart_config": None, "dashboard_config": None}

    logger.info("Running Text2SQL pipeline")
    pipeline_result = run_pipeline(text)

    error = pipeline_result.get("error")
    results = pipeline_result.get("results")
    explanation = pipeline_result.get("explanation", "")
    sql_query = pipeline_result.get("sql_query", "")

    if error or not results:
        error_detail = error or "No results returned"
        logger.warning("Text2SQL returned no usable results | error=%s sql=%r", error_detail, sql_query)
        reply = llm_chat(
            system=CHAT_SYSTEM_PROMPT,
            history=messages,
            user_text=(
                f"The user asked: {text}\n\n"
                f"I tried to query the database but got: {error_detail}\n"
                f"SQL attempted: {sql_query}\n\n"
                "Please provide a helpful response explaining what happened "
                "and suggest how they might rephrase their question."
            ),
        )
        return {"reply": reply, "table_data": None, "chart_config": None, "dashboard_config": None}

    table_preview = results[:10]
    summary_prompt = (
        f"The user asked: {text}\n\n"
        f"Database explanation: {explanation}\n"
        f"SQL query used: {sql_query}\n"
        f"Results ({len(results)} rows, showing first 10):\n"
        f"{json.dumps(table_preview, indent=2, default=str)}\n\n"
        "Provide a concise, insightful answer to the user's question based on this data. "
        "Mention key numbers and trends. Do NOT reproduce the full table — "
        "the table will be shown separately."
    )
    reply = llm_chat(system=CHAT_SYSTEM_PROMPT, history=messages, user_text=summary_prompt)

    logger.info("Text2SQL ok | rows=%d sql=%r", len(results or []), sql_query)

    chart_config: Optional[Dict[str, Any]] = None
    if make_chart and results:
        logger.info("Running ChartAgent | rows=%d", len(results))
        try:
            chart_config = chart_agent.generate(query=text, table_data=results)
            logger.info("ChartAgent ok | type=%s", chart_config.get("type"))
        except Exception as e:
            logger.error("ChartAgent failed: %s", e, exc_info=True)

    return {
        "reply": reply,
        "table_data": results,
        "chart_config": chart_config,
        "dashboard_config": None,
    }
