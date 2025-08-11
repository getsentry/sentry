from sentry import features
from sentry.constants import TARGET_SAMPLE_RATE_DEFAULT
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.helpers.sliding_window import (
    generate_sliding_window_org_cache_key,
)
from sentry.models.organization import Organization

__all__ = ["get_org_sample_rate"]

import logging

logger = logging.getLogger("sentry.dynamic_sampling")


def get_org_sample_rate(
    org_id: int, default_sample_rate: float | None
) -> tuple[float | None, bool]:
    """
    Returns the organization sample rate for dynamic sampling. This returns either the
    target_sample_rate organization option if custom dynamic sampling is enabled. Otherwise
    it will fall back on retrieving the sample rate from the sliding window calculations.
    """

    # check if `organizations:dynamic-sampling-custom` feature flag is enabled for the
    # organization, if yes, return the `sentry:target_sample_rate` option
    try:
        org = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        org = None

    has_dynamic_sampling_custom = features.has("organizations:dynamic-sampling-custom", org)
    if has_dynamic_sampling_custom:
        sample_rate = org.get_option("sentry:target_sample_rate") if org else None
        if features.has("organizations:log-project-config", org):
            logger.info(
                "log-project-config: org.get_option: %s",
                sample_rate,
                extra={
                    "org": org.id if org else None,
                    "target_sample_rate": sample_rate,
                    "default_sample_rate": default_sample_rate,
                },
            )
        if sample_rate is not None:
            return float(sample_rate), True
        if default_sample_rate is not None:
            return default_sample_rate, False
        return TARGET_SAMPLE_RATE_DEFAULT, False

    # fallback to sliding window calculation
    sample_rate, is_custom = _get_sliding_window_org_sample_rate(org_id, default_sample_rate)
    if features.has("organizations:log-project-config", org):
        logger.info(
            "log-project-config: _get_sliding_window_org_sample_rate for org %s",
            org_id,
            extra={
                "sample_rate": sample_rate,
                "is_custom": is_custom,
                "default_sample_rate": default_sample_rate,
            },
        )
    return sample_rate, is_custom


def _get_sliding_window_org_sample_rate(
    org_id: int, default_sample_rate: float | None
) -> tuple[float | None, bool]:
    redis_client = get_redis_client_for_ds()
    cache_key = generate_sliding_window_org_cache_key(org_id)

    try:
        value = redis_client.get(cache_key)

        if value is not None:
            return float(value), True

        return default_sample_rate, False
    except (TypeError, ValueError):
        return default_sample_rate, False
