"""
The Redis cache shared by the dynamic sampling pipelines.

Two pipelines produce sample rates: the legacy task pipeline in ``dynamic_sampling.tasks`` and
the per-organization pipeline in ``dynamic_sampling.per_org``. Each writes into its own key
namespace. This module owns the key structure of both, the serialization, the TTLs and the
behaviour on a cache miss, so that switching an organization from one pipeline to the other is a
single decision made in ``serving_pipeline``.

Writers name their pipeline. Readers do not: they take an organization and are served by
whichever pipeline that organization is on.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import timedelta
from enum import Enum
from typing import overload

import orjson
import sentry_sdk

from sentry import features
from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.models.organization import Organization
from sentry.utils import metrics

PER_ORG_SERVING_FEATURE = "organizations:dynamic-sampling-per-org-serving"

# How long a value survives without the pipeline that wrote it running again. The legacy
# pipeline runs every 10 minutes but processes organizations in large batches, so it keeps a
# day's grace. The per-organization pipeline completes a cycle every 10 minutes, so an hour of
# grace already covers six missed cycles, and expiring sooner means a stalled pipeline falls
# back to the legacy values instead of serving stale ones.
LEGACY_SAMPLE_RATE_TTL = timedelta(hours=24)
PER_ORG_SAMPLE_RATE_TTL = timedelta(hours=1)
# A recalibration factor corrects the previous window's drift, so it is worthless once stale.
RECALIBRATION_FACTOR_TTL = timedelta(minutes=10)


class SamplingPipeline(Enum):
    """The pipeline that produced a cached value. The value is the key prefix."""

    LEGACY = "ds::"
    PER_ORG = "ds::per_org:"


@dataclass(frozen=True)
class CacheKeySpec:
    # Formatted with org_id and project_id. Kept identical to the historical key names, hence
    # the "prioritise" spellings: renaming them would need a migration that buys nothing.
    suffix: str
    legacy_ttl: timedelta
    per_org_ttl: timedelta
    # Set when the legacy key predates the shared structure and cannot be expressed with the
    # same template.
    legacy_suffix: str | None = None

    def key(
        self,
        pipeline: SamplingPipeline,
        *,
        org_id: int | None = None,
        project_id: int | None = None,
    ) -> str:
        suffix = self.suffix
        if pipeline is SamplingPipeline.LEGACY and self.legacy_suffix is not None:
            suffix = self.legacy_suffix
        return pipeline.value + suffix.format(org_id=org_id, project_id=project_id)

    def ttl(self, pipeline: SamplingPipeline) -> timedelta:
        return self.legacy_ttl if pipeline is SamplingPipeline.LEGACY else self.per_org_ttl


class SamplingCacheEntry(Enum):
    ORGANIZATION_SAMPLE_RATE = CacheKeySpec(
        "o:{org_id}:sliding_window_org_sample_rate",
        LEGACY_SAMPLE_RATE_TTL,
        PER_ORG_SAMPLE_RATE_TTL,
    )
    PROJECT_SAMPLE_RATES = CacheKeySpec(
        "o:{org_id}:prioritise_projects",
        LEGACY_SAMPLE_RATE_TTL,
        PER_ORG_SAMPLE_RATE_TTL,
    )
    TRANSACTION_SAMPLE_RATES = CacheKeySpec(
        "o:{org_id}:p:{project_id}:pri_tran",
        LEGACY_SAMPLE_RATE_TTL,
        PER_ORG_SAMPLE_RATE_TTL,
    )
    ORGANIZATION_RECALIBRATION_FACTOR = CacheKeySpec(
        "o:{org_id}:rate_rebalance_factor2",
        RECALIBRATION_FACTOR_TTL,
        RECALIBRATION_FACTOR_TTL,
    )
    PROJECT_RECALIBRATION_FACTOR = CacheKeySpec(
        "p:{project_id}:rate_rebalance_factor2",
        RECALIBRATION_FACTOR_TTL,
        RECALIBRATION_FACTOR_TTL,
    )
    # Set once a pipeline has completed a pass. Its absence means the pipeline is not running,
    # which readers treat differently from "the pipeline ran and this value has no volume". The
    # legacy pipeline covers every organization in one run and so has a single global marker;
    # the per-organization pipeline marks each organization as it finishes.
    PIPELINE_EXECUTED = CacheKeySpec(
        "o:{org_id}:executed",
        timedelta(hours=1),
        timedelta(hours=1),
        legacy_suffix="sliding_window_org_executed",
    )

    def key(
        self,
        pipeline: SamplingPipeline,
        *,
        org_id: int | None = None,
        project_id: int | None = None,
    ) -> str:
        return self.value.key(pipeline, org_id=org_id, project_id=project_id)

    def ttl_ms(self, pipeline: SamplingPipeline) -> int:
        return int(self.value.ttl(pipeline).total_seconds() * 1000)


def serving_pipeline(organization: Organization | None) -> SamplingPipeline:
    """The pipeline that serves this organization's sample rates to Relay."""
    if organization is None:
        return SamplingPipeline.LEGACY
    if features.has(PER_ORG_SERVING_FEATURE, organization):
        return SamplingPipeline.PER_ORG
    return SamplingPipeline.LEGACY


def sample_rate_to_float(sample_rate: str | None) -> float | None:
    """Converts a cached sample rate to a float, or None if it is absent or malformed."""
    if sample_rate is None:
        return None

    try:
        return float(sample_rate)
    except (TypeError, ValueError):
        return None


def _record_read(entry: SamplingCacheEntry, pipeline: SamplingPipeline, hit: bool) -> None:
    metrics.incr(
        "dynamic_sampling.cache.read",
        tags={"entry": entry.name, "pipeline": pipeline.name, "hit": str(hit).lower()},
    )


def _candidate_pipelines(pipeline: SamplingPipeline) -> list[SamplingPipeline]:
    """The pipelines to read a sample rate from, in order of preference.

    An organization served by the per-organization pipeline falls back to the legacy values.
    That keeps an organization flipped over before its first per-organization pass, or one whose
    per-organization pipeline has stalled, on the rates the legacy pipeline computed instead of
    on a hard miss. Recalibration factors deliberately do not do this: see
    ``get_organization_recalibration_factor``.
    """
    if pipeline is SamplingPipeline.PER_ORG:
        return [SamplingPipeline.PER_ORG, SamplingPipeline.LEGACY]
    return [SamplingPipeline.LEGACY]


# Organization sample rate.


def get_organization_sample_rate(
    organization: Organization, pipeline: SamplingPipeline | None = None
) -> float | None:
    """The organization-wide sample rate computed from its ingested volume.

    None means no rate was computed, which callers turn into their own fallback: the
    reserved-quota blended rate, or the configured target rate.
    """
    pipeline = pipeline or serving_pipeline(organization)
    entry = SamplingCacheEntry.ORGANIZATION_SAMPLE_RATE
    redis_client = get_redis_client_for_ds()

    for candidate in _candidate_pipelines(pipeline):
        sample_rate = sample_rate_to_float(
            redis_client.get(entry.key(candidate, org_id=organization.id))
        )
        if sample_rate is not None:
            _record_read(entry, candidate, True)
            return sample_rate

    _record_read(entry, pipeline, False)
    return None


def set_organization_sample_rate(
    pipeline: SamplingPipeline, org_id: int, sample_rate: float
) -> None:
    entry = SamplingCacheEntry.ORGANIZATION_SAMPLE_RATE
    cache_key = entry.key(pipeline, org_id=org_id)
    redis_client = get_redis_client_for_ds()
    with redis_client.pipeline(transaction=False) as redis_pipeline:
        redis_pipeline.set(cache_key, sample_rate)
        redis_pipeline.pexpire(cache_key, entry.ttl_ms(pipeline))
        redis_pipeline.execute()


# Project sample rates, stored as one hash per organization.


@overload
def get_project_sample_rate(
    organization: Organization,
    project_id: int,
    *,
    error_sample_rate_fallback: float,
    pipeline: SamplingPipeline | None = None,
) -> tuple[float, bool]: ...


@overload
def get_project_sample_rate(
    organization: Organization,
    project_id: int,
    *,
    error_sample_rate_fallback: float | None,
    pipeline: SamplingPipeline | None = None,
) -> tuple[float | None, bool]: ...


def get_project_sample_rate(
    organization: Organization,
    project_id: int,
    *,
    error_sample_rate_fallback: float | None,
    pipeline: SamplingPipeline | None = None,
) -> tuple[float | None, bool]:
    """The rebalanced sample rate of a project, and whether it came from the cache.

    On a miss the answer depends on why the value is absent. If a pipeline has completed a pass,
    the project simply had no volume in the last window and is sampled at 100%. If none has,
    something is wrong with the pipelines and the caller's fallback is used instead, so that an
    outage cannot silently promote every project to full sampling.
    """
    pipeline = pipeline or serving_pipeline(organization)
    entry = SamplingCacheEntry.PROJECT_SAMPLE_RATES
    redis_client = get_redis_client_for_ds()
    candidates = _candidate_pipelines(pipeline)

    for candidate in candidates:
        raw = redis_client.hget(
            name=entry.key(candidate, org_id=organization.id), key=str(project_id)
        )
        if raw is None:
            continue

        _record_read(entry, candidate, True)
        sample_rate = sample_rate_to_float(raw)
        if sample_rate is not None:
            return sample_rate, True
        sentry_sdk.capture_message("Invalid boosted project sample rate value stored in cache")
        return error_sample_rate_fallback, False

    _record_read(entry, pipeline, False)

    if any(was_pipeline_executed(candidate, organization.id) for candidate in candidates):
        return 1.0, False

    sentry_sdk.capture_message(
        "Sliding window org value not stored in cache and sliding window org not executed"
    )
    return error_sample_rate_fallback, False


def set_project_sample_rates(
    pipeline: SamplingPipeline, org_id: int, rebalanced_projects: Iterable[RebalancedItem]
) -> dict[int, float | None]:
    """Stores the rebalanced project sample rates, returning the rates they replaced.

    Callers use the previous rates to decide whether a Relay config invalidation is warranted.
    """
    entry = SamplingCacheEntry.PROJECT_SAMPLE_RATES
    cache_key = entry.key(pipeline, org_id=org_id)
    redis_client = get_redis_client_for_ds()

    projects = list(rebalanced_projects)
    if not projects:
        return {}

    project_ids = [str(project.id) for project in projects]
    previous_rates = {
        int(project_id): sample_rate_to_float(raw)
        for project_id, raw in zip(project_ids, redis_client.hmget(cache_key, project_ids))
    }

    with redis_client.pipeline(transaction=False) as redis_pipeline:
        for project in projects:
            redis_pipeline.hset(cache_key, str(project.id), project.new_sample_rate)
        redis_pipeline.pexpire(cache_key, entry.ttl_ms(pipeline))
        redis_pipeline.execute()

    return previous_rates


def get_all_project_sample_rates(
    pipeline: SamplingPipeline, org_id: int
) -> dict[int, float | None]:
    cache_key = SamplingCacheEntry.PROJECT_SAMPLE_RATES.key(pipeline, org_id=org_id)
    return {
        int(project_id): sample_rate_to_float(sample_rate)
        for project_id, sample_rate in get_redis_client_for_ds().hgetall(cache_key).items()
    }


# Transaction sample rates, stored as one JSON document per project.


def get_transaction_sample_rates(
    organization: Organization,
    project_id: int,
    default_rate: float,
    pipeline: SamplingPipeline | None = None,
) -> tuple[Mapping[str, float], float]:
    """The named transaction sample rates of a project, and the rate for every other transaction.

    An empty mapping means no transaction was singled out, and every transaction is sampled at
    ``default_rate``.
    """
    pipeline = pipeline or serving_pipeline(organization)
    entry = SamplingCacheEntry.TRANSACTION_SAMPLE_RATES

    for candidate in _candidate_pipelines(pipeline):
        rates = _read_transaction_sample_rates(candidate, organization.id, project_id)
        if rates is not None:
            _record_read(entry, candidate, True)
            return rates

    _record_read(entry, pipeline, False)
    return {}, default_rate


def _read_transaction_sample_rates(
    pipeline: SamplingPipeline, org_id: int, project_id: int
) -> tuple[Mapping[str, float], float] | None:
    cache_key = SamplingCacheEntry.TRANSACTION_SAMPLE_RATES.key(
        pipeline, org_id=org_id, project_id=project_id
    )
    try:
        serialized = get_redis_client_for_ds().get(cache_key)
        if serialized:
            named_rates, implicit_rate = orjson.loads(serialized)
            return named_rates, float(implicit_rate)
    except (TypeError, ValueError) as e:
        sentry_sdk.capture_exception(e)
    return None


def set_transaction_sample_rates(
    pipeline: SamplingPipeline,
    org_id: int,
    project_id: int,
    named_rates: Iterable[RebalancedItem],
    default_rate: float,
) -> None:
    entry = SamplingCacheEntry.TRANSACTION_SAMPLE_RATES
    cache_key = entry.key(pipeline, org_id=org_id, project_id=project_id)
    value = [{rate.id: rate.new_sample_rate for rate in named_rates}, default_rate]

    redis_client = get_redis_client_for_ds()
    redis_client.set(cache_key, orjson.dumps(value).decode())
    redis_client.pexpire(cache_key, entry.ttl_ms(pipeline))


def get_all_transaction_sample_rates(
    pipeline: SamplingPipeline, org_id: int, project_ids: Iterable[int]
) -> dict[int, tuple[Mapping[str, float], float] | None]:
    ordered_project_ids = list(project_ids)
    if not ordered_project_ids:
        return {}

    entry = SamplingCacheEntry.TRANSACTION_SAMPLE_RATES
    redis_client = get_redis_client_for_ds()
    with redis_client.pipeline(transaction=False) as redis_pipeline:
        for project_id in ordered_project_ids:
            redis_pipeline.get(entry.key(pipeline, org_id=org_id, project_id=project_id))
        serialized_values = redis_pipeline.execute()

    result: dict[int, tuple[Mapping[str, float], float] | None] = {}
    for project_id, serialized in zip(ordered_project_ids, serialized_values):
        if serialized is None:
            result[project_id] = None
            continue
        try:
            named_rates, implicit_rate = orjson.loads(serialized)
        except (TypeError, ValueError) as e:
            sentry_sdk.capture_exception(e)
            result[project_id] = None
            continue
        result[project_id] = (named_rates, float(implicit_rate))
    return result


# Recalibration factors. Both are multipliers, so an absent value means 1.0 and generates no rule.


def get_organization_recalibration_factor(
    organization: Organization, pipeline: SamplingPipeline | None = None
) -> float:
    pipeline = pipeline or serving_pipeline(organization)
    # No fallback to the legacy factor. It corrects the drift of the legacy pipeline's own rates,
    # so applying it on top of per-organization rates would push them the wrong way.
    return _get_factor(
        SamplingCacheEntry.ORGANIZATION_RECALIBRATION_FACTOR, pipeline, org_id=organization.id
    )


def set_organization_recalibration_factor(
    pipeline: SamplingPipeline, org_id: int, factor: float
) -> None:
    _set_factor(
        SamplingCacheEntry.ORGANIZATION_RECALIBRATION_FACTOR,
        pipeline,
        factor,
        "dynamic_sampling.cache.set_organization_recalibration_factor",
        org_id=org_id,
    )


def delete_organization_recalibration_factor(pipeline: SamplingPipeline, org_id: int) -> None:
    _delete_factor(
        SamplingCacheEntry.ORGANIZATION_RECALIBRATION_FACTOR,
        pipeline,
        "dynamic_sampling.cache.delete_organization_recalibration_factor",
        org_id=org_id,
    )


def get_project_recalibration_factor(
    organization: Organization | None, project_id: int, pipeline: SamplingPipeline | None = None
) -> float:
    # The organization is only needed to route the read; the key itself is project-scoped, so a
    # caller that pins the pipeline does not have to load one.
    pipeline = pipeline or serving_pipeline(organization)
    if pipeline is SamplingPipeline.PER_ORG:
        # The per-organization pipeline does not compute per-project recalibration yet, and the
        # legacy factor belongs to the legacy rates, so the only correct answer is the identity.
        return 1.0
    return _get_factor(
        SamplingCacheEntry.PROJECT_RECALIBRATION_FACTOR, pipeline, project_id=project_id
    )


def set_project_recalibration_factor(
    pipeline: SamplingPipeline, project_id: int, factor: float
) -> None:
    _set_factor(
        SamplingCacheEntry.PROJECT_RECALIBRATION_FACTOR,
        pipeline,
        factor,
        "dynamic_sampling.cache.set_project_recalibration_factor",
        project_id=project_id,
    )


def delete_project_recalibration_factor(pipeline: SamplingPipeline, project_id: int) -> None:
    _delete_factor(
        SamplingCacheEntry.PROJECT_RECALIBRATION_FACTOR,
        pipeline,
        "dynamic_sampling.cache.delete_project_recalibration_factor",
        project_id=project_id,
    )


def _get_factor(
    entry: SamplingCacheEntry,
    pipeline: SamplingPipeline,
    *,
    org_id: int | None = None,
    project_id: int | None = None,
) -> float:
    value = get_redis_client_for_ds().get(entry.key(pipeline, org_id=org_id, project_id=project_id))
    factor = sample_rate_to_float(value)
    _record_read(entry, pipeline, factor is not None)
    return factor if factor is not None else 1.0


def _set_factor(
    entry: SamplingCacheEntry,
    pipeline: SamplingPipeline,
    factor: float,
    metric: str,
    *,
    org_id: int | None = None,
    project_id: int | None = None,
) -> None:
    # A factor of 1.0 is the identity of the multiplication, so storing it would only produce a
    # rule that changes nothing. Dropping the key is equivalent and keeps the rule set smaller.
    if factor == 1.0:
        _delete_factor(entry, pipeline, metric, org_id=org_id, project_id=project_id)
        return

    cache_key = entry.key(pipeline, org_id=org_id, project_id=project_id)
    redis_client = get_redis_client_for_ds()
    redis_client.set(cache_key, factor)
    redis_client.pexpire(cache_key, entry.ttl_ms(pipeline))
    metrics.distribution(metric, factor, tags={"pipeline": pipeline.name})


def _delete_factor(
    entry: SamplingCacheEntry,
    pipeline: SamplingPipeline,
    metric: str,
    *,
    org_id: int | None = None,
    project_id: int | None = None,
) -> None:
    get_redis_client_for_ds().delete(entry.key(pipeline, org_id=org_id, project_id=project_id))
    metrics.incr(f"{metric}.deleted", tags={"pipeline": pipeline.name})


# Execution marker.


def mark_pipeline_executed(pipeline: SamplingPipeline, org_id: int | None = None) -> None:
    entry = SamplingCacheEntry.PIPELINE_EXECUTED
    cache_key = entry.key(pipeline, org_id=org_id)
    redis_client = get_redis_client_for_ds()
    redis_client.set(cache_key, 1)
    redis_client.pexpire(cache_key, entry.ttl_ms(pipeline))


def was_pipeline_executed(pipeline: SamplingPipeline, org_id: int | None = None) -> bool:
    cache_key = SamplingCacheEntry.PIPELINE_EXECUTED.key(pipeline, org_id=org_id)
    return bool(get_redis_client_for_ds().exists(cache_key))
