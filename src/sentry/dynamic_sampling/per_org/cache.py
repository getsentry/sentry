from __future__ import annotations

from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.constants import adjusted_factor_ttl_ms
from sentry.utils import metrics

PER_ORG_RECALIBRATION_FACTOR_CACHE_KEY = "ds::per_org:o:{org_id}:recalibration_factor"


def generate_recalibrate_orgs_cache_key(org_id: int) -> str:
    return PER_ORG_RECALIBRATION_FACTOR_CACHE_KEY.format(org_id=org_id)


def set_guarded_adjusted_factor(org_id: int, adjusted_factor: float) -> None:
    if adjusted_factor != 1.0:
        redis_client = get_redis_client_for_ds()
        cache_key = generate_recalibrate_orgs_cache_key(org_id)
        redis_client.set(cache_key, adjusted_factor)
        redis_client.pexpire(cache_key, adjusted_factor_ttl_ms())
        metrics.distribution(
            "dynamic_sampling.per_org.recalibration.set_guarded_adjusted_factor",
            adjusted_factor,
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
        "dynamic_sampling.per_org.recalibration.get_adjusted_factor",
        tags={"source": source, "result": "hit" if factor is not None else "miss"},
    )
    return 1.0 if factor is None else factor


def delete_adjusted_factor(org_id: int) -> None:
    redis_client = get_redis_client_for_ds()
    cache_key = generate_recalibrate_orgs_cache_key(org_id)
    redis_client.delete(cache_key)
    metrics.incr("dynamic_sampling.per_org.recalibration.delete_adjusted_factor")
