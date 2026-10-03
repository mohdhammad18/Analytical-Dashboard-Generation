import asyncio
from src.core.supabase import get_async_supabase_client

async def inspect():
    client = await get_async_supabase_client()
    res = await client.table('monthly_chart').select('*').limit(5).execute()
    print("Columns:", res.data[0].keys() if res.data else "No data")
    print("Sample:", res.data[:5])

if __name__ == "__main__":
    asyncio.run(inspect())
