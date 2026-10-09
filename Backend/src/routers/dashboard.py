import asyncio
import logging

from fastapi import APIRouter

from src.core.config import settings
from src.core.supabase import get_async_supabase_client
from src.services.local_sample import sample_tables

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
    responses={404: {"description": "Not found"}},
)


async def _load_tables():
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        logger.info("Supabase is not configured; serving the local sample dataset")
        return sample_tables()

    supabase_client = await get_async_supabase_client()
    tasks = [
        supabase_client.table('monthly_chart').select('*').execute(),
        supabase_client.table('combined_data_by_output_type').select('*').execute(),
        supabase_client.table('combined_data_by_channel_user').select('*').execute(),
        supabase_client.table('client1_combined_data').select('*').execute(),
        supabase_client.table('combined_data_by_input_type').select('*').execute(),
        supabase_client.table('combined_data_by_language').select('*').execute()
    ]
    results = await asyncio.gather(*tasks)
    return {
        "month_wise_data": results[0].data,
        "output_type_data": results[1].data,
        "user_data": results[2].data,
        "channel_data": results[3].data,
        "input_type_data": results[4].data,
        "language_data": results[5].data,
    }


@router.get("/")
async def get_dashboard_data():
    try:
        tables = await _load_tables()
    except Exception:
        logger.exception("Live dashboard fetch failed; serving the local sample dataset")
        tables = sample_tables()

    month_wise_data = tables["month_wise_data"]
    output_type_data = tables["output_type_data"]
    user_data = tables["user_data"]
    channel_data = tables["channel_data"]
    input_type_data = tables["input_type_data"]
    language_data = tables["language_data"]

    # Helper to safely convert a value to int (handles None, str, float)
    def safe_int(val, default=0):
        if val is None:
            return default
        try:
            return int(float(val))
        except (ValueError, TypeError):
            return default

    # Helper to convert HH:MM:SS to decimal hours
    def to_decimal_hours(duration_str):
        if not duration_str:
            return 0
        try:
            d_str = str(duration_str).split('.')[0]
            parts = d_str.split(':')
            if len(parts) == 3:
                h, m, s = int(parts[0]), int(parts[1]), int(parts[2])
                return round(h + (m / 60) + (s / 3600), 2)
        except (ValueError, TypeError):
            pass
        return 0

    # Augment distribution data with decimal hours
    for item in output_type_data:
        item['uploaded_hours'] = to_decimal_hours(item.get('uploaded_duration'))
        item['created_hours'] = to_decimal_hours(item.get('created_duration'))
        item['published_hours'] = to_decimal_hours(item.get('published_duration'))

    for item in input_type_data:
        item['uploaded_hours'] = to_decimal_hours(item.get('uploaded_duration'))
        item['created_hours'] = to_decimal_hours(item.get('created_duration'))
        item['published_hours'] = to_decimal_hours(item.get('published_duration'))

    for item in language_data:
        item['uploaded_hours'] = to_decimal_hours(item.get('uploaded_duration'))
        item['created_hours'] = to_decimal_hours(item.get('created_duration'))
        item['published_hours'] = to_decimal_hours(item.get('published_duration'))

    # Helper to add durations in HH:MM:SS format
    def add_durations(durations):
        total_seconds = 0
        for d in durations:
            if not d:
                continue
            d_str = str(d).split('.')[0]
            parts = d_str.split(':')
            if len(parts) == 3:
                try:
                    h, m, s = int(parts[0]), int(parts[1]), int(parts[2])
                    total_seconds += h * 3600 + m * 60 + s
                except (ValueError, TypeError):
                    continue
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        return f'{hours:02d}:{minutes:02d}:{seconds:02d}'

    # Calculate KPI Data dynamically
    total_uploaded = sum(safe_int(item.get('uploaded_count')) for item in output_type_data)
    total_created = sum(safe_int(item.get('created_count')) for item in output_type_data)
    total_published = sum(safe_int(item.get('published_count')) for item in output_type_data)

    total_uploaded_duration = add_durations(item.get('uploaded_duration') for item in output_type_data)
    total_created_duration = add_durations(item.get('created_duration') for item in output_type_data)
    total_published_duration = add_durations(item.get('published_duration') for item in output_type_data)

    kpi_data = {
      "totalUploaded": total_uploaded,
      "totalCreated": total_created,
      "totalPublished": total_published,
      "totalUploadedDuration": total_uploaded_duration,
      "totalCreatedDuration": total_created_duration,
      "totalPublishedDuration": total_published_duration,
    }

    return {
        "monthWiseData": month_wise_data,
        "outputTypeData": output_type_data,
        "inputTypeData": input_type_data,
        "languageData": language_data,
        "channelData": channel_data,
        "userData": user_data,
        "kpiData": kpi_data
    }
