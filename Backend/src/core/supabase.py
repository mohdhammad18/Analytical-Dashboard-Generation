"""Primary Supabase client for the analytics / data database (settings.SUPABASE_*)."""

from functools import lru_cache

from supabase import Client, create_client, AsyncClient, create_async_client

from src.core.config import settings


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    """Return a cached Supabase client using app settings."""
    url = settings.SUPABASE_URL
    key = settings.SUPABASE_KEY
    if not url or not key:
        raise ValueError(
            "Supabase URL and Key must be configured (SUPABASE_URL, SUPABASE_KEY in .env)."
        )
    return create_client(url, key)


_async_client: AsyncClient | None = None


async def get_async_supabase_client() -> AsyncClient:
    """Return a cached Async Supabase client using app settings (async-safe)."""
    global _async_client
    if _async_client is not None:
        return _async_client

    url = settings.SUPABASE_URL
    key = settings.SUPABASE_KEY
    if not url or not key:
        raise ValueError(
            "Supabase URL and Key must be configured (SUPABASE_URL, SUPABASE_KEY in .env)."
        )

    _async_client = await create_async_client(url, key)
    return _async_client
