# FastAPI Backend

FastAPI app for chat, text-to-SQL, charts, dashboards, and the main analytics dashboard API.

## Layout

- `src/main.py` — app factory, CORS, logging
- `src/core/` — settings, LLM factory, Supabase (data DB), logging config
- `src/routers/` — HTTP routes (`/chat`, `/dashboard`, `/workspace`, sessions, preferences)
- `src/services/` — agents (chat, text-to-SQL, chart, dashboard), history service
- `migrations/` — SQL for history / workspace tables (Supabase)

## Setup

1. Install [uv](https://github.com/astral-sh/uv).
2. `uv sync`
3. Copy/configure `.env` (Supabase, `DATABASE_URL`, `GROQ_API_KEY` / `OPENAI_API_KEY`, optional `USE_OPENAI`).
4. Run:

   ```bash
   uv run python src/main.py
   ```

   or:

   ```bash
   uv run uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
   ```

## Docs

- OpenAPI: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/health`
