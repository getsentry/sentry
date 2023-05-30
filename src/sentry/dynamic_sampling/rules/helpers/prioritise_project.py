from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds


def _generate_cache_key(org_id: int) -> str:
    return f"ds::o:{org_id}:prioritise_projects"


def get_prioritise_by_project_sample_rate(
    org_id: int, project_id: int, default_sample_rate: float
) -> float:
    """
    This function returns cached sample rate from prioritise by project
    celery task or fallback to None
    """
    redis_client = get_redis_client_for_ds()
    cache_key = _generate_cache_key(org_id=org_id)

    try:
        cached_sample_rate = float(redis_client.hget(cache_key, project_id))
    except (TypeError, ValueError):
        cached_sample_rate = None

    return cached_sample_rate if cached_sample_rate else default_sample_rate
