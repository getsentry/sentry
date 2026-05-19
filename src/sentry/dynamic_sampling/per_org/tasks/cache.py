from __future__ import annotations

from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds

PER_ORG_RECALIBRATION_FACTOR_CACHE_KEY = "ds::per_org:o:{org_id}:recalibration_factor"


def generate_recalibrate_orgs_cache_key(org_id: int) -> str:
    return PER_ORG_RECALIBRATION_FACTOR_CACHE_KEY.format(org_id=org_id)


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


# class DynamicSamplingCacheKey(StrEnum):
#     PER_ORG_RECALIBRATION_FACTOR = "ds::per_org:o:{org_id}:recalibration_factor"


# class DynamicSamplingCache:
#     def __init__(self) -> None:
#         self.redis_client = get_redis_client_for_ds()

#     def get_cache_key(self, key: DynamicSamplingCacheKey, **kwargs) -> str:
#         return key.format(**kwargs)
