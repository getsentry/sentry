from sentry import features
from sentry.constants import TARGET_SAMPLE_RATE_DEFAULT
from sentry.dynamic_sampling.cache import SamplingPipeline, get_organization_sample_rate
from sentry.models.organization import Organization

__all__ = ["get_org_sample_rate"]

import logging

logger = logging.getLogger("sentry.dynamic_sampling")


def get_org_sample_rate(
    org_id: int, default_sample_rate: float | None, pipeline: SamplingPipeline | None = None
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
        if sample_rate is not None:
            return float(sample_rate), True
        if default_sample_rate is not None:
            return default_sample_rate, False
        return TARGET_SAMPLE_RATE_DEFAULT, False

    if org is None:
        return default_sample_rate, False

    # fallback to sliding window calculation
    sample_rate = get_organization_sample_rate(org, pipeline=pipeline)
    if sample_rate is None:
        return default_sample_rate, False
    return sample_rate, True
