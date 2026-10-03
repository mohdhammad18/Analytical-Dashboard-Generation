from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    APP_NAME: str = "FastAPI Backend"
    ADMIN_EMAIL: str = "admin@example.com"
    DATABASE_URL: str = "sqlite:///./test.db"
    
    # Supabase Settings
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    # History DB (separate Supabase project for state/history)
    HISTORY_SUPABASE_URL: str = ""
    HISTORY_SUPABASE_KEY: str = ""

    # Groq Settings
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # OpenAI Settings
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # LLM provider switch: set USE_OPENAI=true to use OpenAI, false for Groq
    USE_OPENAI: str = "false"

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
