from fastapi import APIRouter
from src.routers import dashboard, chat, sessions, workspace, preferences

api_router = APIRouter()
api_router.include_router(dashboard.router, tags=["dashboard"])
api_router.include_router(chat.router, tags=["chat"])
api_router.include_router(sessions.router)
api_router.include_router(workspace.router)
api_router.include_router(preferences.router)
