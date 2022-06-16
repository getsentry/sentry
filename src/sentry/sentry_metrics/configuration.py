from dataclasses import dataclass
from enum import Enum
from typing import MutableMapping, Optional

from django.conf import settings


class ProfileKey(Enum):
    RELEASE_HEALTH = "release-health"
    PERFORMANCE = "performance"


DEFAULT_PROFILE_KEY = ProfileKey.RELEASE_HEALTH


@dataclass(frozen=True)
class MetricsIngestConfiguration:
    db_model: ProfileKey
    input_topic: str
    output_topic: str
    use_case_id: Optional[str]
    internal_metrics_tag: Optional[str]


_METRICS_INGEST_CONFIG_BY_PROFILE_KEY: MutableMapping[
    ProfileKey, MetricsIngestConfiguration
] = dict()
_METRICS_INGEST_CONFIG_BY_USE_CASE: MutableMapping[str, MetricsIngestConfiguration] = dict()


def _register_ingest_config(config: MetricsIngestConfiguration) -> None:
    _METRICS_INGEST_CONFIG_BY_PROFILE_KEY[config.db_model] = config
    _METRICS_INGEST_CONFIG_BY_USE_CASE[config.use_case_id] = config


_register_ingest_config(
    MetricsIngestConfiguration(
        db_model=ProfileKey.RELEASE_HEALTH,
        input_topic=settings.KAFKA_INGEST_METRICS,
        output_topic=settings.KAFKA_SNUBA_METRICS,
        use_case_id="release-health",
        internal_metrics_tag="release-health",
    )
)
_register_ingest_config(
    MetricsIngestConfiguration(
        db_model=ProfileKey.PERFORMANCE,
        input_topic=settings.KAFKA_INGEST_PERFORMANCE_METRICS,
        output_topic=settings.KAFKA_SNUBA_GENERIC_METRICS,
        use_case_id="performance",
        internal_metrics_tag="perf",
    )
)


def get_ingest_config(profile_key: ProfileKey) -> MetricsIngestConfiguration:
    return _METRICS_INGEST_CONFIG_BY_PROFILE_KEY[profile_key]


def get_ingest_config_from_use_case_id(use_case_id: str) -> MetricsIngestConfiguration:
    return _METRICS_INGEST_CONFIG_BY_USE_CASE[use_case_id]
