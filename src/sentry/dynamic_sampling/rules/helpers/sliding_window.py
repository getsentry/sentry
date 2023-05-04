from calendar import IllegalMonthError, monthrange
from datetime import datetime
from typing import TYPE_CHECKING, Optional

import pytz

from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds

if TYPE_CHECKING:
    from sentry.models import Project


def generate_sliding_window_cache_key(org_id: int) -> str:
    return f"ds::o:{org_id}:sliding_window"


def get_sliding_window_sample_rate(project: "Project", default_sample_rate: float) -> float:
    redis_client = get_redis_client_for_ds()
    cache_key = generate_sliding_window_cache_key(project.organization.id)

    try:
        return float(redis_client.hget(cache_key, project.id))
    except (TypeError, ValueError):
        return default_sample_rate


def extrapolate_monthly_volume(volume: int, hours: int) -> Optional[int]:
    # We allow at least 1 hour for the extrapolation.
    if hours < 1:
        return None

    # Get current year and month
    year = datetime.now(tz=pytz.UTC).year
    month = datetime.now(tz=pytz.UTC).month

    try:
        # Get number of days in the month.
        _, days_in_month = monthrange(year=year, month=month)
        # We compute the number of hours in a month.
        hours_in_month = days_in_month * 24
        # We compute how many groups of hours can fit in a month.
        groups_of_hours = hours_in_month / hours
        # Given n groups we just multiply the volume per group of hours.
        return int(volume * groups_of_hours)
    except IllegalMonthError:
        return None
