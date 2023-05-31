from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds


def generate_prioritise_by_project_cache_key(org_id: int) -> str:
    return f"ds::o:{org_id}:prioritise_projects"


def get_prioritise_by_project_sample_rate(
    org_id: int, project_id: int, error_sample_rate_fallback: float
) -> float:
    """
    This function returns cached sample rate from prioritise by project
    celery task or fallback to None
    """
    redis_client = get_redis_client_for_ds()
    cache_key = generate_prioritise_by_project_cache_key(org_id=org_id)

    try:
        return float(redis_client.hget(cache_key, project_id))
    except (TypeError, ValueError):
        return error_sample_rate_fallback
