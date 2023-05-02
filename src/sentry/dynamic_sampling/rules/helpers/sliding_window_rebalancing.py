from typing import TYPE_CHECKING

from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds

if TYPE_CHECKING:
    from sentry.models import Project


def generate_sliding_window_rebalancing_cache_key(org_id: int) -> str:
    return f"ds::o:{org_id}:sliding_window_rebalancing"


def get_rebalanced_sample_rate(project: "Project", base_sample_rate: float) -> float:
    redis_client = get_redis_client_for_ds()
    cache_key = generate_sliding_window_rebalancing_cache_key(project.organization.id)

    try:
        return float(redis_client.hget(cache_key, project.id))
    except (TypeError, ValueError):
        return base_sample_rate
