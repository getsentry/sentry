from __future__ import annotations

from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.constants import ADJUSTED_FACTOR_REDIS_CACHE_KEY_TTL
from sentry.utils import metrics

PER_ORG_RECALIBRATION_FACTOR_CACHE_KEY = "ds::per_org:o:{org_id}:recalibration_factor"


def generate_recalibrate_orgs_cache_key(org_id: int) -> str:
    return PER_ORG_RECALIBRATION_FACTOR_CACHE_KEY.format(org_id=org_id)


def set_guarded_adjusted_factor(org_id: int, adjusted_factor: float) -> None:
    if adjusted_factor != 1.0:
        redis_client = get_redis_client_for_ds()
        cache_key = generate_recalibrate_orgs_cache_key(org_id)
        redis_client.set(cache_key, adjusted_factor)
        redis_client.pexpire(cache_key, ADJUSTED_FACTOR_REDIS_CACHE_KEY_TTL)
        metrics.distribution(
            "dynamic_sampling.per_org.recalibration.set_guarded_adjusted_factor",
            adjusted_factor,
        )
    else:
        delete_adjusted_factor(org_id)


def get_adjusted_factor(org_id: int) -> float:
    redis_client = get_redis_client_for_ds()
    cache_key = generate_recalibrate_orgs_cache_key(org_id)

    try:
        value = redis_client.get(cache_key)
        if value is not None:
            return float(value)
    except (TypeError, ValueError):
        pass
    return 1.0


def delete_adjusted_factor(org_id: int) -> None:
    redis_client = get_redis_client_for_ds()
    cache_key = generate_recalibrate_orgs_cache_key(org_id)
    redis_client.delete(cache_key)
    metrics.incr("dynamic_sampling.per_org.recalibration.delete_adjusted_factor")
