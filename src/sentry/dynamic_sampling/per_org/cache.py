from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence

import orjson
import sentry_sdk

from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.constants import (
    DEFAULT_REDIS_CACHE_KEY_TTL,
    adjusted_factor_ttl_ms,
)
from sentry.utils import metrics

PER_ORG_RECALIBRATION_FACTOR_CACHE_KEY = "ds::per_org:o:{org_id}:recalibration_factor"
PER_ORG_PROJECT_SAMPLE_RATES_CACHE_KEY = "ds::per_org:o:{org_id}:project_sample_rates"
PER_ORG_TRANSACTION_SAMPLE_RATES_CACHE_KEY = (
    "ds::per_org:o:{org_id}:p:{project_id}:transaction_sample_rates"
)


def generate_recalibrate_orgs_cache_key(org_id: int) -> str:
    return PER_ORG_RECALIBRATION_FACTOR_CACHE_KEY.format(org_id=org_id)


def generate_project_sample_rates_cache_key(org_id: int) -> str:
    return PER_ORG_PROJECT_SAMPLE_RATES_CACHE_KEY.format(org_id=org_id)


def generate_transaction_sample_rates_cache_key(org_id: int, project_id: int) -> str:
    return PER_ORG_TRANSACTION_SAMPLE_RATES_CACHE_KEY.format(org_id=org_id, project_id=project_id)


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


def set_project_sample_rates(org_id: int, rebalanced_projects: Iterable[RebalancedItem]) -> None:
    """Store the balanced per-project sample rates this pipeline computed.

    Mirrors the layout of the legacy ``prioritise_projects`` hash, so that both pipelines
    are readable the same way and one can replace the other for a single organization.
    """
    items = list(rebalanced_projects)
    if not items:
        return

    redis_client = get_redis_client_for_ds()
    cache_key = generate_project_sample_rates_cache_key(org_id)
    with redis_client.pipeline(transaction=False) as pipeline:
        for item in items:
            pipeline.hset(cache_key, str(item.id), item.new_sample_rate)
        pipeline.pexpire(cache_key, DEFAULT_REDIS_CACHE_KEY_TTL)
        pipeline.execute()


def get_project_sample_rate(org_id: int, project_id: int) -> float | None:
    """The balanced sample rate of a project, or None when this pipeline has not stored one."""
    redis_client = get_redis_client_for_ds()
    cache_key = generate_project_sample_rates_cache_key(org_id)
    try:
        value = redis_client.hget(name=cache_key, key=str(project_id))
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError) as exc:
        sentry_sdk.capture_exception(exc)
        return None


def set_transaction_sample_rates(
    org_id: int, sample_rates_by_project: Mapping[int, tuple[Sequence[RebalancedItem], float]]
) -> None:
    """Store the balanced per-transaction sample rates of an organization's projects.

    Each stored value has the same shape as the legacy ``pri_tran`` entry: the named rates
    followed by the rate that applies to every transaction without one.
    """
    if not sample_rates_by_project:
        return

    redis_client = get_redis_client_for_ds()
    with redis_client.pipeline(transaction=False) as pipeline:
        for project_id, (named_rates, implicit_rate) in sample_rates_by_project.items():
            cache_key = generate_transaction_sample_rates_cache_key(org_id, project_id)
            pipeline.set(
                cache_key,
                orjson.dumps(
                    [{str(item.id): item.new_sample_rate for item in named_rates}, implicit_rate]
                ).decode(),
            )
            pipeline.pexpire(cache_key, DEFAULT_REDIS_CACHE_KEY_TTL)
        pipeline.execute()


def get_transaction_sample_rates(
    org_id: int, project_id: int
) -> tuple[Mapping[str, float], float] | None:
    """The named and implicit transaction sample rates of a project.

    Returns None when this pipeline has not stored any, so that the caller can tell an
    absent entry apart from a project whose transactions all sample at the implicit rate.
    """
    redis_client = get_redis_client_for_ds()
    cache_key = generate_transaction_sample_rates_cache_key(org_id, project_id)
    try:
        serialized = redis_client.get(cache_key)
        if not serialized:
            return None
        named_rates, implicit_rate = orjson.loads(serialized)
        return named_rates, float(implicit_rate)
    except (TypeError, ValueError) as exc:
        sentry_sdk.capture_exception(exc)
        return None
