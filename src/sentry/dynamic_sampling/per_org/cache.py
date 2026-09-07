from __future__ import annotations

import math
from collections.abc import Iterable, Mapping, Sequence
from datetime import timedelta
from typing import TYPE_CHECKING

import orjson
import sentry_sdk

from sentry import options
from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.dynamic_sampling.per_org.configuration import BaseDynamicSamplingConfiguration

PER_ORG_ORGANIZATION_SAMPLE_RATE_CACHE_KEY = "ds::per_org:o:{org_id}:organization_sample_rate"
PER_ORG_RECALIBRATION_FACTOR_CACHE_KEY = "ds::per_org:o:{org_id}:recalibration_factor"
PER_ORG_PROJECT_SAMPLE_RATES_CACHE_KEY = "ds::per_org:o:{org_id}:project_sample_rates"
PER_ORG_TRANSACTION_SAMPLE_RATES_CACHE_KEY = (
    "ds::per_org:o:{org_id}:p:{project_id}:transaction_sample_rates"
)

# TTL in milliseconds of the sample rates a pass stores.
DEFAULT_REDIS_CACHE_KEY_TTL = 24 * 60 * 60 * 1000

ADJUSTED_FACTOR_TTL_MINUTES_OPTION = "dynamic-sampling.recalibration.factor-ttl-minutes"
CLAMP_REBALANCE_FACTOR_OPTION = "dynamic-sampling.recalibration.clamp-factor"

# Bounds of the recalibration factor, so that one pass cannot move an organization's
# sampling too far from its target.
MIN_REBALANCE_FACTOR = 0.1
MAX_REBALANCE_FACTOR = 10

# Each pass applies its correction on top of the stored factor, so a second pass within
# one scheduler cycle compounds it. A factor younger than this is left alone.
MIN_RECALIBRATION_FACTOR_AGE = timedelta(minutes=9)


def adjusted_factor_ttl_ms() -> int:
    return int(options.get(ADJUSTED_FACTOR_TTL_MINUTES_OPTION)) * 60 * 1000


def bounded_rebalance_factor(factor: float) -> float | None:
    """The factor bounded to [MIN_REBALANCE_FACTOR, MAX_REBALANCE_FACTOR].

    An out-of-range factor is clamped to the nearest bound when the clamp option
    is on, and discarded (None) otherwise. A discarded factor tells the caller
    to delete the stored factor.
    """
    if MIN_REBALANCE_FACTOR <= factor <= MAX_REBALANCE_FACTOR:
        return factor
    if options.get(CLAMP_REBALANCE_FACTOR_OPTION):
        metrics.incr("dynamic_sampling.recalibration.factor_clamped")
        return min(max(factor, MIN_REBALANCE_FACTOR), MAX_REBALANCE_FACTOR)
    return None


def sample_rate_to_float(sample_rate: str | None) -> float | None:
    """
    Converts a sample rate to a float or returns None in case the conversion failed.
    """
    if sample_rate is None:
        return None

    try:
        return float(sample_rate)
    except (TypeError, ValueError):
        return None


def are_equal_with_epsilon(a: float | None, b: float | None) -> bool:
    """
    Checks if two floating point numbers are equal within an error boundary.
    """
    if a is None and b is None:
        return True

    if a is None or b is None:
        return False

    return math.isclose(a, b)


def write_caches(config: BaseDynamicSamplingConfiguration) -> None:
    org_id = config.organization.id
    set_organization_sample_rate(org_id, config.get_sample_rate())
    wrote_recalibration_factor = write_recalibration_factor(
        org_id, config.results.recalibration_factor
    )
    wrote_project_rates = set_project_sample_rates(org_id, config.results.rebalanced_projects)
    wrote_transaction_rates = set_transaction_sample_rates(
        org_id, config.results.rebalanced_transactions
    )
    if not (wrote_recalibration_factor or wrote_project_rates or wrote_transaction_rates):
        return

    schedule_invalidate_project_config(organization_id=org_id, trigger="dynamic_sampling_per_org")


def write_recalibration_factor(org_id: int, factor: float | None) -> bool:
    if factor is None:
        return False

    age = get_adjusted_factor_age(org_id)
    if age is not None and age < MIN_RECALIBRATION_FACTOR_AGE:
        metrics.incr("dynamic_sampling.per_org.recalibration.factor_write_skipped")
        return False

    bounded_factor = bounded_rebalance_factor(factor)
    if bounded_factor is not None:
        set_adjusted_factor(org_id, bounded_factor)
    else:
        delete_adjusted_factor(org_id)
    return True


def generate_organization_sample_rate_cache_key(org_id: int) -> str:
    return PER_ORG_ORGANIZATION_SAMPLE_RATE_CACHE_KEY.format(org_id=org_id)


def generate_recalibrate_orgs_cache_key(org_id: int) -> str:
    return PER_ORG_RECALIBRATION_FACTOR_CACHE_KEY.format(org_id=org_id)


def generate_project_sample_rates_cache_key(org_id: int) -> str:
    return PER_ORG_PROJECT_SAMPLE_RATES_CACHE_KEY.format(org_id=org_id)


def generate_transaction_sample_rates_cache_key(org_id: int, project_id: int) -> str:
    return PER_ORG_TRANSACTION_SAMPLE_RATES_CACHE_KEY.format(org_id=org_id, project_id=project_id)


def set_organization_sample_rate(org_id: int, sample_rate: float | None) -> None:
    """Store the sample rate a pass balanced an organization's projects against.

    It is what the organization reports as its desired sample rate. A pass without one
    leaves the stored rate alone, so that a transient failure does not drop it.
    """
    if sample_rate is None:
        return

    redis_client = get_redis_client_for_ds()
    cache_key = generate_organization_sample_rate_cache_key(org_id)
    with redis_client.pipeline(transaction=False) as pipeline:
        pipeline.set(cache_key, sample_rate)
        pipeline.pexpire(cache_key, DEFAULT_REDIS_CACHE_KEY_TTL)
        pipeline.execute()


def get_organization_sample_rate(org_id: int) -> float | None:
    """The stored sample rate of an organization, or None when no pass has stored one."""
    redis_client = get_redis_client_for_ds()
    return sample_rate_to_float(
        redis_client.get(generate_organization_sample_rate_cache_key(org_id))
    )


def set_adjusted_factor(org_id: int, adjusted_factor: float) -> None:
    if adjusted_factor != 1.0:
        redis_client = get_redis_client_for_ds()
        cache_key = generate_recalibrate_orgs_cache_key(org_id)
        redis_client.set(cache_key, adjusted_factor)
        redis_client.pexpire(cache_key, adjusted_factor_ttl_ms())
        metrics.distribution(
            "dynamic_sampling.per_org.recalibration.set_adjusted_factor",
            adjusted_factor,
        )
    else:
        delete_adjusted_factor(org_id)


def read_adjusted_factor(org_id: int, source: str) -> float | None:
    """The stored factor of an organization, or None when it has none stored."""
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
    return factor


def get_adjusted_factor(org_id: int, source: str) -> float:
    factor = read_adjusted_factor(org_id, source)
    return 1.0 if factor is None else factor


def get_adjusted_factor_age(org_id: int) -> timedelta | None:
    """How long ago the stored factor was written, derived from its remaining TTL.

    None when there is no stored factor or it has no expiry.
    """
    redis_client = get_redis_client_for_ds()
    remaining_ms = redis_client.pttl(generate_recalibrate_orgs_cache_key(org_id))
    if remaining_ms < 0:
        return None
    return timedelta(milliseconds=adjusted_factor_ttl_ms() - remaining_ms)


def delete_adjusted_factor(org_id: int) -> None:
    redis_client = get_redis_client_for_ds()
    cache_key = generate_recalibrate_orgs_cache_key(org_id)
    redis_client.delete(cache_key)
    metrics.incr("dynamic_sampling.per_org.recalibration.delete_adjusted_factor")


def set_project_sample_rates(org_id: int, rebalanced_projects: Iterable[RebalancedItem]) -> bool:
    """Store the balanced per-project sample rates this pipeline computed.

    Only rates that moved are written. Most projects keep the same rate from one pass to
    the next, and a project with no volume keeps it forever. The expiry is always renewed,
    so that a project whose rate never moves does not fall out of the cache and back to the
    fallback sample rate.

    Returns whether any rate was written, which is what makes the organization's rules
    worth republishing.
    """
    items = list(rebalanced_projects)
    if not items:
        return False

    redis_client = get_redis_client_for_ds()
    cache_key = generate_project_sample_rates_cache_key(org_id)
    cached_rates = {
        project_id: sample_rate_to_float(sample_rate)
        for project_id, sample_rate in redis_client.hgetall(cache_key).items()
    }

    changed = [
        item
        for item in items
        if not are_equal_with_epsilon(cached_rates.get(str(item.id)), item.new_sample_rate)
    ]
    with redis_client.pipeline(transaction=False) as pipeline:
        for item in changed:
            pipeline.hset(cache_key, str(item.id), item.new_sample_rate)
        pipeline.pexpire(cache_key, DEFAULT_REDIS_CACHE_KEY_TTL)
        pipeline.execute()

    return bool(changed)


def has_project_rates(org_id: int) -> bool:
    redis_client = get_redis_client_for_ds()
    return bool(redis_client.exists(generate_project_sample_rates_cache_key(org_id)))


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
) -> bool:
    """Store the balanced per-transaction sample rates of an organization's projects.

    Each stored value holds the named rates followed by the rate that applies to every
    transaction without one.

    Returns whether anything was written, which is what makes the organization's rules
    worth republishing.
    """
    if not sample_rates_by_project:
        return False

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

    return True


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
