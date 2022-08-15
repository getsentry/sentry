from dataclasses import dataclass
from enum import Enum
from typing import Any, Mapping, MutableMapping, Optional

from django.conf import settings


class UseCaseKey(Enum):
    RELEASE_HEALTH = "release-health"
    PERFORMANCE = "performance"


class RateLimiterNamespace(Enum):
    RELEASE_HEALTH = "releasehealth"
    PERFORMANCE = "performance"


@dataclass(frozen=True)
class MetricsIngestConfiguration:
    input_topic: str
    output_topic: str
    use_case_id: UseCaseKey
    internal_metrics_tag: Optional[str]
    writes_limiter_namespace: RateLimiterNamespace


_METRICS_INGEST_CONFIG_BY_USE_CASE: MutableMapping[UseCaseKey, MetricsIngestConfiguration] = dict()


def _register_ingest_config(config: MetricsIngestConfiguration) -> None:
    _METRICS_INGEST_CONFIG_BY_USE_CASE[config.use_case_id] = config


def get_ingest_config(use_case_key: UseCaseKey) -> MetricsIngestConfiguration:
    if len(_METRICS_INGEST_CONFIG_BY_USE_CASE) == 0:
        _register_ingest_config(
            MetricsIngestConfiguration(
                input_topic=settings.KAFKA_INGEST_METRICS,
                output_topic=settings.KAFKA_SNUBA_METRICS,
                use_case_id=UseCaseKey.RELEASE_HEALTH,
                internal_metrics_tag="release-health",
                writes_limiter_namespace=RateLimiterNamespace.RELEASE_HEALTH,
            )
        )
        _register_ingest_config(
            MetricsIngestConfiguration(
                input_topic=settings.KAFKA_INGEST_PERFORMANCE_METRICS,
                output_topic=settings.KAFKA_SNUBA_GENERIC_METRICS,
                use_case_id=UseCaseKey.PERFORMANCE,
                internal_metrics_tag="perf",
                writes_limiter_namespace=RateLimiterNamespace.PERFORMANCE,
            )
        )

    return _METRICS_INGEST_CONFIG_BY_USE_CASE[use_case_key]


@dataclass(frozen=True)
class RateLimiterConfiguration:
    namespace: RateLimiterNamespace
    writes_limiter_cluster_options: Mapping[str, Any]


_WRITES_RATELIMITER_BY_NAMESPACE: MutableMapping[
    RateLimiterNamespace, RateLimiterConfiguration
] = dict()


def _register_ratelimiter_config(config: RateLimiterConfiguration) -> None:
    _WRITES_RATELIMITER_BY_NAMESPACE[config.namespace] = config


def get_writes_ratelimiter_config(namespace: RateLimiterNamespace) -> RateLimiterConfiguration:
    if len(_WRITES_RATELIMITER_BY_NAMESPACE) == 0:
        _register_ratelimiter_config(
            RateLimiterConfiguration(
                namespace=RateLimiterNamespace.RELEASE_HEALTH,
                writes_limiter_cluster_options=settings.SENTRY_METRICS_INDEXER_WRITES_LIMITER_OPTIONS,
            )
        )
        _register_ratelimiter_config(
            RateLimiterConfiguration(
                namespace=RateLimiterNamespace.PERFORMANCE,
                writes_limiter_cluster_options=settings.SENTRY_METRICS_INDEXER_WRITES_LIMITER_OPTIONS_PERFORMANCE,
            )
        )
    return _WRITES_RATELIMITER_BY_NAMESPACE[namespace]
