from calendar import IllegalMonthError, monthrange
from datetime import datetime, timezone

from sentry import options

# In case a misconfiguration happens on the server side which makes the option invalid, we want to define a fallback
# sliding window size, which in this case will be 24 hours.
FALLBACK_SLIDING_WINDOW_SIZE = 24


def get_sliding_window_size() -> int | None:
    try:
        size = options.get("dynamic-sampling:sliding_window.size")
        # We want to explicitly handle the None case, which will signal that the system should be stopped.
        return None if size is None else int(size)
    except ValueError:
        # In case the value set is invalid, we will fallback to a default value, to keep the system up and running.
        return FALLBACK_SLIDING_WINDOW_SIZE


def extrapolate_monthly_volume(volume: int, hours: int) -> int | None:
    # We don't support a lower granularity than 1 hour.
    if hours < 1:
        return None

    # Get current year and month
    year = datetime.now(tz=timezone.utc).year
    month = datetime.now(tz=timezone.utc).month

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
