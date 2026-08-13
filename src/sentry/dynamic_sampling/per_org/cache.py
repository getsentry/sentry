from __future__ import annotations

from typing import TYPE_CHECKING

from sentry.dynamic_sampling.per_org.results import RecalibrationOutcome
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.constants import ADJUSTED_FACTOR_REDIS_CACHE_KEY_TTL
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.dynamic_sampling.per_org.configuration import BaseDynamicSamplingConfiguration

PER_ORG_RECALIBRATION_FACTOR_CACHE_KEY = "ds::per_org:o:{org_id}:recalibration_factor"


def write_caches(config: BaseDynamicSamplingConfiguration) -> None:
    """Persist what one pass of the per-org pipeline computed.

    Runs once at the end of the pass, so that every cache the new pipeline owns is written
    from one place out of ``config.results``, rather than by the stage that happens to
    compute it. Only the recalibration factor is written today: the project and transaction
    sample rates are still served from the legacy pipeline, and this pass only compares
    against them.
    """
    results = config.results
    if (
        results.recalibration_outcome is RecalibrationOutcome.APPLIED
        and results.recalibration_factor is not None
    ):
        set_guarded_adjusted_factor(config.organization.id, results.recalibration_factor)
    elif results.recalibration_outcome is RecalibrationOutcome.OUT_OF_BOUNDS:
        # A factor outside the rebalance bounds clears the cached one, so that a stale
        # factor cannot keep being applied.
        delete_adjusted_factor(config.organization.id)


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
