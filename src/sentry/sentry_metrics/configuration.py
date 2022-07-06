from dataclasses import dataclass
from enum import Enum
from typing import MutableMapping, Optional

from django.conf import settings


class UseCaseKey(Enum):
    RELEASE_HEALTH = "release-health"
    PERFORMANCE = "performance"


class DbKey(Enum):
    STRING_INDEXER = "StringIndexer"
    PERF_STRING_INDEXER = "PerfStringIndexer"


@dataclass(frozen=True)
class MetricsIngestConfiguration:
    db_model: DbKey
    input_topic: str
    output_topic: str
    use_case_id: UseCaseKey
    internal_metrics_tag: Optional[str]


_METRICS_INGEST_CONFIG_BY_USE_CASE: MutableMapping[UseCaseKey, MetricsIngestConfiguration] = dict()


def _register_ingest_config(config: MetricsIngestConfiguration) -> None:
    _METRICS_INGEST_CONFIG_BY_USE_CASE[config.use_case_id] = config


_register_ingest_config(
    MetricsIngestConfiguration(
        db_model=DbKey.STRING_INDEXER,
        input_topic=settings.KAFKA_INGEST_METRICS,
        output_topic=settings.KAFKA_SNUBA_METRICS,
        use_case_id=UseCaseKey.RELEASE_HEALTH,
        internal_metrics_tag="release-health",
    )
)
_register_ingest_config(
    MetricsIngestConfiguration(
        db_model=DbKey.PERF_STRING_INDEXER,
        input_topic=settings.KAFKA_INGEST_PERFORMANCE_METRICS,
        output_topic=settings.KAFKA_SNUBA_GENERIC_METRICS,
        use_case_id=UseCaseKey.PERFORMANCE,
        internal_metrics_tag="perf",
    )
)


def get_ingest_config(use_case_key: UseCaseKey) -> MetricsIngestConfiguration:
    return _METRICS_INGEST_CONFIG_BY_USE_CASE[use_case_key]
