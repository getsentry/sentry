from dataclasses import dataclass
from enum import Enum
from typing import Any, Mapping, MutableMapping, Optional

from django.conf import settings


class UseCaseKey(Enum):
    RELEASE_HEALTH = "release-health"
    PERFORMANCE = "performance"


# Rate limiter namespaces, the postgres (PG)
# values are the same as UseCaseKey to keep
# backwards compatibility
RELEASE_HEALTH_PG_NAMESPACE = "releasehealth"
PERFORMANCE_PG_NAMESPACE = "performance"


@dataclass(frozen=True)
class MetricsIngestConfiguration:
    input_topic: str
    output_topic: str
    use_case_id: UseCaseKey
    internal_metrics_tag: Optional[str]
    writes_limiter_cluster_options: Mapping[str, Any]
    writes_limiter_namespace: str


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
                writes_limiter_cluster_options=settings.SENTRY_METRICS_INDEXER_WRITES_LIMITER_OPTIONS,
                writes_limiter_namespace=RELEASE_HEALTH_PG_NAMESPACE,
            )
        )
        _register_ingest_config(
            MetricsIngestConfiguration(
                input_topic=settings.KAFKA_INGEST_PERFORMANCE_METRICS,
                output_topic=settings.KAFKA_SNUBA_GENERIC_METRICS,
                use_case_id=UseCaseKey.PERFORMANCE,
                internal_metrics_tag="perf",
                writes_limiter_cluster_options=settings.SENTRY_METRICS_INDEXER_WRITES_LIMITER_OPTIONS_PERFORMANCE,
                writes_limiter_namespace=PERFORMANCE_PG_NAMESPACE,
            )
        )

    return _METRICS_INGEST_CONFIG_BY_USE_CASE[use_case_key]
