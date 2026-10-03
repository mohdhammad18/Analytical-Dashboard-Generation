from typing import List, Dict, Any, Optional
from supabase import create_client, Client
from src.core.config import settings


def _get_client() -> Optional[Client]:
    url = settings.HISTORY_SUPABASE_URL
    key = settings.HISTORY_SUPABASE_KEY
    if not url or not key:
        return None
    return create_client(url, key)


class HistoryService:
    """CRUD operations against the history Supabase DB."""

    def __init__(self):
        self.client = _get_client()

    @property
    def available(self) -> bool:
        return self.client is not None

    # ── Sessions ─────────────────────────────────────────────────────────

    def create_session(self, title: str = "New Chat") -> Dict[str, Any]:
        resp = self.client.table("chat_sessions").insert({"title": title}).execute()
        return resp.data[0]

    def list_sessions(self, limit: int = 50) -> List[Dict[str, Any]]:
        resp = (
            self.client.table("chat_sessions")
            .select("*")
            .order("updated_at", desc=True)
            .limit(limit)
            .execute()
        )
        return resp.data

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        resp = (
            self.client.table("chat_sessions")
            .select("*")
            .eq("id", session_id)
            .execute()
        )
        return resp.data[0] if resp.data else None

    def update_session(self, session_id: str, title: str) -> Dict[str, Any]:
        resp = (
            self.client.table("chat_sessions")
            .update({"title": title})
            .eq("id", session_id)
            .execute()
        )
        return resp.data[0] if resp.data else {}

    def delete_session(self, session_id: str) -> None:
        self.client.table("chat_sessions").delete().eq("id", session_id).execute()

    def touch_session(self, session_id: str) -> None:
        """Bump updated_at to now (trigger handles it)."""
        self.client.table("chat_sessions").update(
            {"title": self.get_session(session_id).get("title", "Chat")}
        ).eq("id", session_id).execute()

    # ── Messages ─────────────────────────────────────────────────────────

    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        table_data: Optional[List[Dict]] = None,
        chart_config: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        row = {
            "session_id": session_id,
            "role": role,
            "content": content,
            "table_data": table_data,
            "chart_config": chart_config,
        }
        resp = self.client.table("chat_messages").insert(row).execute()
        self.touch_session(session_id)
        return resp.data[0]

    def get_messages(self, session_id: str) -> List[Dict[str, Any]]:
        resp = (
            self.client.table("chat_messages")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at", desc=False)
            .execute()
        )
        return resp.data

    # ── Workspace Charts ─────────────────────────────────────────────────

    def add_workspace_chart(
        self,
        chart_config: Dict[str, Any],
        title: str = "Untitled Chart",
        session_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        row = {
            "title": title,
            "chart_config": chart_config,
            "session_id": session_id,
        }
        resp = self.client.table("workspace_charts").insert(row).execute()
        return resp.data[0]

    def list_workspace_charts(self) -> List[Dict[str, Any]]:
        resp = (
            self.client.table("workspace_charts")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        return resp.data

    def delete_workspace_chart(self, chart_id: str) -> None:
        self.client.table("workspace_charts").delete().eq("id", chart_id).execute()

    def toggle_pin_chart(self, chart_id: str, pinned: bool) -> Dict[str, Any]:
        resp = (
            self.client.table("workspace_charts")
            .update({"pinned": pinned})
            .eq("id", chart_id)
            .execute()
        )
        return resp.data[0] if resp.data else {}

    # ── Workspace Dashboards ────────────────────────────────────────────

    def add_workspace_dashboard(
        self,
        dashboard_config: Dict[str, Any],
        title: str = "Untitled Dashboard",
        session_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        row = {
            "title": title,
            "dashboard_config": dashboard_config,
            "session_id": session_id,
        }
        resp = self.client.table("workspace_dashboards").insert(row).execute()
        return resp.data[0]

    def list_workspace_dashboards(self) -> List[Dict[str, Any]]:
        resp = (
            self.client.table("workspace_dashboards")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        return resp.data

    def delete_workspace_dashboard(self, dashboard_id: str) -> None:
        self.client.table("workspace_dashboards").delete().eq("id", dashboard_id).execute()

    # ── Preferences ──────────────────────────────────────────────────────

    def get_preferences(self) -> Dict[str, Any]:
        resp = self.client.table("user_preferences").select("*").eq("id", 1).execute()
        return resp.data[0] if resp.data else {}

    def update_preferences(self, **kwargs) -> Dict[str, Any]:
        allowed = {"active_session_id", "make_chart_default", "chat_panel_width"}
        payload = {k: v for k, v in kwargs.items() if k in allowed}
        if not payload:
            return self.get_preferences()
        resp = (
            self.client.table("user_preferences")
            .update(payload)
            .eq("id", 1)
            .execute()
        )
        return resp.data[0] if resp.data else {}


history_service = HistoryService()
