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


def extrapolate_monthly_volume(daily_volume: int) -> Optional[int]:
    # Get current year and month
    year = datetime.now(tz=pytz.UTC).year
    month = datetime.now(tz=pytz.UTC).month

    try:
        # Get number of days in the month
        _, days_in_month = monthrange(year=year, month=month)
        # Calculate and return forecasted monthly volume
        return daily_volume * days_in_month
    except IllegalMonthError:
        return None
