from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.constants import adjusted_factor_ttl_ms
from sentry.utils import metrics


def generate_recalibrate_orgs_cache_key(org_id: int) -> str:
    return f"ds::o:{org_id}:rate_rebalance_factor2"


def set_guarded_adjusted_factor(org_id: int, adjusted_factor: float) -> None:
    redis_client = get_redis_client_for_ds()
    cache_key = generate_recalibrate_orgs_cache_key(org_id)

    # Only if the factor we want to adjust is different from 1.0 we want to store a value in Redis, since it doesn't
    # make sense to 1.0 because the generated rule will multiply by 1.0 any number which won't make any difference.
    if adjusted_factor != 1.0:
        redis_client.set(cache_key, adjusted_factor)
        # Since we don't want any error to cause the system to drift significantly from the target sample rate, we want
        # to set a small TTL for the adjusted factor.
        redis_client.pexpire(cache_key, adjusted_factor_ttl_ms())
        metrics.distribution(
            "dynamic_sampling.tasks.recalibrate_orgs.set_guarded_adjusted_factor", adjusted_factor
        )
    else:
        delete_adjusted_factor(org_id)


def get_adjusted_factor(org_id: int, source: str) -> float:
    redis_client = get_redis_client_for_ds()
    cache_key = generate_recalibrate_orgs_cache_key(org_id)

    factor = None
    try:
        value = redis_client.get(cache_key)
        if value is not None:
            factor = float(value)
    except (TypeError, ValueError):
        pass

    metrics.incr(
        "dynamic_sampling.tasks.recalibrate_orgs.get_adjusted_factor",
        tags={"source": source, "result": "hit" if factor is not None else "miss"},
    )
    return 1.0 if factor is None else factor


def delete_adjusted_factor(org_id: int) -> None:
    redis_client = get_redis_client_for_ds()
    cache_key = generate_recalibrate_orgs_cache_key(org_id)

    redis_client.delete(cache_key)
    metrics.incr("dynamic_sampling.tasks.recalibrate_orgs.delete_adjusted_factor")


def generate_recalibrate_projects_cache_key(project_id: int) -> str:
    return f"ds::p:{project_id}:rate_rebalance_factor2"


def set_guarded_adjusted_project_factor(project_id: int, adjusted_factor: float) -> None:
    redis_client = get_redis_client_for_ds()
    cache_key = generate_recalibrate_projects_cache_key(project_id)

    # Only if the factor we want to adjust is different from 1.0 we want to store a value in Redis, since it doesn't
    # make sense to 1.0 because the generated rule will multiply by 1.0 any number which won't make any difference.
    if adjusted_factor != 1.0:
        redis_client.set(cache_key, adjusted_factor)
        # Since we don't want any error to cause the system to drift significantly from the target sample rate, we want
        # to set a small TTL for the adjusted factor.
        redis_client.pexpire(cache_key, adjusted_factor_ttl_ms())
        metrics.distribution(
            "dynamic_sampling.tasks.recalibrate_projects.set_guarded_adjusted_project_factor",
            adjusted_factor,
        )
    else:
        delete_adjusted_project_factor(project_id)


def get_adjusted_project_factor(project_id: int, source: str) -> float:
    redis_client = get_redis_client_for_ds()
    cache_key = generate_recalibrate_projects_cache_key(project_id)

    factor = None
    try:
        value = redis_client.get(cache_key)
        if value is not None:
            factor = float(value)
    except (TypeError, ValueError):
        pass

    metrics.incr(
        "dynamic_sampling.tasks.recalibrate_projects.get_adjusted_project_factor",
        tags={"source": source, "result": "hit" if factor is not None else "miss"},
    )
    return 1.0 if factor is None else factor


def delete_adjusted_project_factor(project_id: int) -> None:
    redis_client = get_redis_client_for_ds()
    cache_key = generate_recalibrate_projects_cache_key(project_id)

    redis_client.delete(cache_key)
    metrics.incr("dynamic_sampling.tasks.recalibrate_projects.delete_adjusted_project_factor")


def compute_adjusted_factor(
    prev_factor: float, effective_sample_rate: float, target_sample_rate: float
) -> float | None:
    """
    Calculates an adjustment factor in order to bring the effective sample rate close to the target sample rate.
    """
    # If the factor is outside the range, we can't do much besides bailing.
    # We also bail, when we don't have a valid effective sample rate.
    if prev_factor <= 0.0 or effective_sample_rate == 0.0:
        return None

    # This formula aims at scaling the factor proportionally to the ratio of the sample rate we are targeting compared
    # to the effective sample rate of that org. An imbalance in the ratio can be introduced by many factors, including
    # biases that oversample or down sample irrespectively of the incoming volume.
    return prev_factor * (target_sample_rate / effective_sample_rate)
