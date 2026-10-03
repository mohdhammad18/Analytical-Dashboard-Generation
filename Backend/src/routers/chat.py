from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any, Literal, Optional

from src.services.orchestrator import orchestrate
from src.services.history import history_service

router = APIRouter()


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = []
    text: str
    make_chart: bool = False
    make_dashboard: bool = False
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    status: str = "success"
    reply: str
    table_data: Optional[List[Dict[str, Any]]] = None
    chart_config: Optional[Dict[str, Any]] = None
    dashboard_config: Optional[Dict[str, Any]] = None
    session_id: Optional[str] = None
    metadata: dict = {}


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat endpoint with optional text-to-SQL and chart generation.

    - **messages**: Ordered list of past conversation messages.
    - **text**: The new user message.
    - **make_chart**: When true, generates a Recharts ChartConfig from SQL results.
    - **session_id**: Optional session ID for history persistence.
    """
    try:
        past = [{"role": m.role, "content": m.content} for m in request.messages]

        # Auto-create session if history DB is available but no session_id provided
        session_id = request.session_id
        if history_service.available and not session_id:
            session = history_service.create_session(
                title=request.text[:60] + ("..." if len(request.text) > 60 else "")
            )
            session_id = session["id"]

        # Persist user message
        if history_service.available and session_id:
            history_service.add_message(
                session_id=session_id,
                role="user",
                content=request.text,
            )

        result = orchestrate(
            messages=past,
            text=request.text,
            make_chart=request.make_chart,
            make_dashboard=request.make_dashboard,
        )

        # Persist assistant message
        if history_service.available and session_id:
            history_service.add_message(
                session_id=session_id,
                role="assistant",
                content=result["reply"],
                table_data=result.get("table_data"),
                chart_config=result.get("chart_config"),
            )
            history_service.update_preferences(active_session_id=session_id)

        return ChatResponse(
            status="success",
            reply=result["reply"],
            table_data=result.get("table_data"),
            chart_config=result.get("chart_config"),
            dashboard_config=result.get("dashboard_config"),
            session_id=session_id,
            metadata={
                "has_table": result.get("table_data") is not None,
                "has_chart": result.get("chart_config") is not None,
                "has_dashboard": result.get("dashboard_config") is not None,
            },
        )
    except Exception as e:
        return ChatResponse(
            status="error",
            reply=f"Chat agent error: {str(e)}",
            metadata={"err_type": type(e).__name__},
        )
