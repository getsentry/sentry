from __future__ import annotations

from typing import overload

import sentry_sdk

from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.helpers.sliding_window import was_sliding_window_org_executed


def generate_boost_low_volume_projects_cache_key(org_id: int) -> str:
    # The cache key name wasn't be changed, since it would require a migration which is not worth it.
    return f"ds::o:{org_id}:prioritise_projects"


@overload
def get_boost_low_volume_projects_sample_rate(
    org_id: int, project_id: int, *, error_sample_rate_fallback: float
) -> tuple[float, bool]: ...


@overload
def get_boost_low_volume_projects_sample_rate(
    org_id: int, project_id: int, *, error_sample_rate_fallback: float | None
) -> tuple[float | None, bool]: ...


def get_boost_low_volume_projects_sample_rate(
    org_id: int, project_id: int, *, error_sample_rate_fallback: float | None
) -> tuple[float | None, bool]:
    """Get the sample rate and whether it was directly retrieved or is a fallback.

    Returns:
        A tuple containing:
            - float: The sample rate value
            - bool: Whether the sample rate was directly retrieved (True) or is a fallback (False)
    """
    redis_client = get_redis_client_for_ds()
    cache_key = generate_boost_low_volume_projects_cache_key(org_id=org_id)

    try:
        value = redis_client.hget(name=cache_key, key=str(project_id))
        assert value is not None
        return float(value), True
    # Thrown if the input is not a string or a float (e.g., None).
    except (TypeError, AssertionError):
        # In case there is no value in cache, we want to check if the sliding window org was executed. If it was
        # executed, but we didn't have this project boosted, it means that the entire org didn't have traffic in the
        # last hour which resulted in the system not considering it at all.
        if was_sliding_window_org_executed():
            return 1.0, False

        # In the other case were the sliding window was not run, maybe because of an issue, we will just fall back to
        # blended sample rate, to avoid oversampling.
        sentry_sdk.capture_message(
            "Sliding window org value not stored in cache and sliding window org not executed"
        )
        return error_sample_rate_fallback, False
    # Thrown if the input is not a valid float.
    except ValueError:
        sentry_sdk.capture_message("Invalid boosted project sample rate value stored in cache")
        return error_sample_rate_fallback, False
