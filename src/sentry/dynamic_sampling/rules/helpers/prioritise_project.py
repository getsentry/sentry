from typing import TYPE_CHECKING, Optional

from sentry import features
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds

if TYPE_CHECKING:
    from sentry.models import Project


# We use this coeffietien to calculate new adjusted sample rate
# as close as it can be to actual sample rate
ADJUSTED_COEFFICIENT = 0.1


def _generate_cache_key(org_id: int) -> str:
    return f"ds::o:{org_id}:prioritise_projects"


def _generate_cache_key_actual_rate(org_id: int) -> str:
    return f"ds::o:{org_id}:prioritise_projects:actual_rate"


def apply_actual_sample_rate(
    blended_sample_rate: float,
    adjusted_sample_rate: Optional[float],
    actual_sample_rate: Optional[float],
) -> Optional[float]:
    if not (adjusted_sample_rate and actual_sample_rate):
        return None
    if actual_sample_rate < blended_sample_rate:
        # It means we are under sampling, so we can increase `adjusted_sample_rate` on 10%
        # Note: 10% selected randomly
        return adjusted_sample_rate + (adjusted_sample_rate * ADJUSTED_COEFFICIENT)
    elif actual_sample_rate > blended_sample_rate:
        # It means we are over sampling, so we can decrease `adjusted_sample_rate` on 10%
        return adjusted_sample_rate - (adjusted_sample_rate * ADJUSTED_COEFFICIENT)
    return adjusted_sample_rate


def get_prioritise_by_project_sample_rate(project: "Project", default_sample_rate: float) -> float:
    """
    This function returns cached sample rate from prioritise by project
    celery task or fallback to None
    """
    redis_client = get_redis_client_for_ds()
    cache_key = _generate_cache_key(project.organization.id)
    try:
        adjusted_sample_rate = float(redis_client.hget(cache_key, project.id))
    except (TypeError, ValueError):
        adjusted_sample_rate = None

    cache_key_actual_rate = _generate_cache_key_actual_rate(project.organization.id)
    try:
        actual_sample_rate = float(redis_client.hget(cache_key_actual_rate, project.id))
    except (TypeError, ValueError):
        actual_sample_rate = None
    if features.has("organizations:ds-apply-actual-sample-rate-to-biases", project.organization):
        new_adjusted_sample_rate = apply_actual_sample_rate(
            default_sample_rate, adjusted_sample_rate, actual_sample_rate
        )
        adjusted_sample_rate = (
            new_adjusted_sample_rate if new_adjusted_sample_rate else adjusted_sample_rate
        )

    return adjusted_sample_rate if adjusted_sample_rate else default_sample_rate
