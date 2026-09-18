from sentry import features
from sentry.constants import TARGET_SAMPLE_RATE_DEFAULT
from sentry.models.organization import Organization

__all__ = ["get_org_sample_rate"]


def get_org_sample_rate(
    org_id: int, default_sample_rate: float | None
) -> tuple[float | None, bool]:
    """
    Returns the organization sample rate for dynamic sampling and whether it was configured by
    the organization. With custom dynamic sampling this is the target_sample_rate organization
    option. Without it, or when the option is unset, the default is returned.
    """
    try:
        org = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        org = None

    if not features.has("organizations:dynamic-sampling-custom", org):
        return default_sample_rate, False

    sample_rate = org.get_option("sentry:target_sample_rate") if org else None
    if sample_rate is not None:
        return float(sample_rate), True
    if default_sample_rate is not None:
        return default_sample_rate, False
    return TARGET_SAMPLE_RATE_DEFAULT, False
