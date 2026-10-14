from datetime import timedelta

from django.db.models.enums import TextChoices

STANDARD_INTERVALS: dict[str, tuple[str, timedelta]] = {
    "1m": ("one minute", timedelta(minutes=1)),
    "5m": ("5 minutes", timedelta(minutes=5)),
    "15m": ("15 minutes", timedelta(minutes=15)),
    "1h": ("one hour", timedelta(hours=1)),
    "1d": ("one day", timedelta(hours=24)),
    "1w": ("one week", timedelta(days=7)),
    "30d": ("30 days", timedelta(days=30)),
}

COMPARISON_INTERVALS: dict[str, tuple[str, timedelta]] = {
    "5m": ("5 minutes", timedelta(minutes=5)),
    "15m": ("15 minutes", timedelta(minutes=15)),
    "1h": ("one hour", timedelta(hours=1)),
    "1d": ("one day", timedelta(hours=24)),
    "1w": ("one week", timedelta(days=7)),
    "30d": ("30 days", timedelta(days=30)),
}

PERCENT_INTERVALS: dict[str, tuple[str, timedelta]] = {
    "1m": ("1 minute", timedelta(minutes=1)),
    "5m": ("5 minutes", timedelta(minutes=5)),
    "10m": ("10 minutes", timedelta(minutes=10)),
    "30m": ("30 minutes", timedelta(minutes=30)),
    "1h": ("1 hour", timedelta(minutes=60)),
}

PERCENT_INTERVALS_TO_DISPLAY: dict[str, tuple[str, timedelta]] = {
    "5m": ("5 minutes", timedelta(minutes=5)),
    "10m": ("10 minutes", timedelta(minutes=10)),
    "30m": ("30 minutes", timedelta(minutes=30)),
    "1h": ("1 hour", timedelta(minutes=60)),
}

SNUBA_LIMIT = 10000
MIN_SESSIONS_TO_FIRE = 50
EVENT_UNIQUE_USER_FREQUENCY_WITH_CONDITIONS_ID = (
    "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyConditionWithConditions"
)


class ComparisonType(TextChoices):
    COUNT = "count"
    PERCENT = "percent"


def percent_increase(result: int | float, comparison_result: int | float) -> int:
    # Treat an empty baseline as an increase of 100% per current result.
    if comparison_result <= 0:
        return int(max(0, result) * 100)

    change = (result - comparison_result) / comparison_result * 100
    return int(max(0, change))
