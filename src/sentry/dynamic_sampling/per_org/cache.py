from __future__ import annotations

from sentry.dynamic_sampling.per_org.calculations import RecalibrationSource
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.constants import ADJUSTED_FACTOR_REDIS_CACHE_KEY_TTL
from sentry.utils import metrics

PER_ORG_RECALIBRATION_FACTOR_CACHE_KEY = "ds::per_org:o:{org_id}:recalibration_factor:{source}"


def generate_recalibrate_orgs_cache_key(org_id: int, source: RecalibrationSource) -> str:
    """
    One key per volume source. The factor is a running product of its own history, so a
    source that reads another source's previous factor multiplies in an error that was
    already corrected for and never settles.
    """
    return PER_ORG_RECALIBRATION_FACTOR_CACHE_KEY.format(org_id=org_id, source=source.value)


def set_guarded_adjusted_factor(
    org_id: int, source: RecalibrationSource, adjusted_factor: float
) -> None:
    if adjusted_factor != 1.0:
        redis_client = get_redis_client_for_ds()
        cache_key = generate_recalibrate_orgs_cache_key(org_id, source)
        redis_client.set(cache_key, adjusted_factor)
        redis_client.pexpire(cache_key, ADJUSTED_FACTOR_REDIS_CACHE_KEY_TTL)
        metrics.distribution(
            "dynamic_sampling.per_org.recalibration.set_guarded_adjusted_factor",
            adjusted_factor,
            tags={"source": source.value},
        )
    else:
        delete_adjusted_factor(org_id, source)


def get_adjusted_factor(org_id: int, source: RecalibrationSource) -> float:
    redis_client = get_redis_client_for_ds()
    cache_key = generate_recalibrate_orgs_cache_key(org_id, source)

    try:
        value = redis_client.get(cache_key)
        if value is not None:
            return float(value)
    except (TypeError, ValueError):
        pass
    return 1.0


def delete_adjusted_factor(org_id: int, source: RecalibrationSource) -> None:
    redis_client = get_redis_client_for_ds()
    cache_key = generate_recalibrate_orgs_cache_key(org_id, source)
    redis_client.delete(cache_key)
    metrics.incr(
        "dynamic_sampling.per_org.recalibration.delete_adjusted_factor",
        tags={"source": source.value},
    )
