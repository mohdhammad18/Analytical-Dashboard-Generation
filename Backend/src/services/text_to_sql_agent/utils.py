import os
import psycopg2
from dotenv import load_dotenv, find_dotenv

from src.core.supabase import get_supabase_client

# Search upwards for the .env file (useful when nested in services/text_to_sql_agent)
load_dotenv(find_dotenv(usecwd=True), override=True)

# Config (dotenv ensures os.getenv works for scripts / subprocesses)
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

def execute_raw_sql(query: str):
    """Executes raw SQL on the PostgreSQL database and returns results as dicts."""
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL is not set. Direct Postgres connection is required.")
    
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(query)
            if cur.description:
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
                return [dict(zip(columns, row)) for row in rows]
            else:
                conn.commit()
                return []
    finally:
        conn.close()
