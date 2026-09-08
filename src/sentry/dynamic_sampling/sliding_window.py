from __future__ import annotations

from calendar import IllegalMonthError, monthrange
from datetime import datetime, timezone

import sentry_sdk

from sentry import quotas

# Hours of volume the sample rate of a subscription-backed organization is derived from.
SLIDING_WINDOW_HOURS = 24


def extrapolate_monthly_volume(volume: int, hours: int) -> int | None:
    # We don't support a lower granularity than 1 hour.
    if hours < 1:
        return None

    now = datetime.now(tz=timezone.utc)
    try:
        _, days_in_month = monthrange(year=now.year, month=now.month)
    except IllegalMonthError:
        return None

    hours_in_month = days_in_month * 24
    groups_of_hours = hours_in_month / hours
    return int(volume * groups_of_hours)


def compute_sliding_window_sample_rate(
    org_id: int, total_root_count: int, window_size: int = SLIDING_WINDOW_HOURS
) -> float | None:
    """
    The sample rate the quotas backend assigns to the volume an organization would send in a
    month, extrapolated from the volume it sent in the last ``window_size`` hours.
    """
    extrapolated_volume = extrapolate_monthly_volume(volume=total_root_count, hours=window_size)
    if extrapolated_volume is None:
        with sentry_sdk.isolation_scope() as scope:
            scope.set_extra("org_id", org_id)
            scope.set_extra("window_size", window_size)
            sentry_sdk.capture_message("The volume of the current month can't be extrapolated.")
        return None

    sampling_tier = quotas.backend.get_transaction_sampling_tier_for_volume(
        org_id, extrapolated_volume
    )
    if sampling_tier is None:
        return None

    _, sample_rate = sampling_tier
    return float(sample_rate)
