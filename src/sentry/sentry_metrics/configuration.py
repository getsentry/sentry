import os
from dataclasses import dataclass
from typing import Mapping, Optional

from django.conf import settings


@dataclass(frozen=True)
class MetricsIngestConfiguration:
    name: str
    input_topic: str
    output_topic: str
    use_case_id: Optional[str]
    internal_metrics_tag: Optional[str]


_METRICS_INGEST_CONFIG: Mapping[str, MetricsIngestConfiguration] = {
    "release-health": MetricsIngestConfiguration(
        name="release-health",
        input_topic=settings.KAFKA_INGEST_METRICS,
        output_topic=settings.KAFKA_SNUBA_METRICS,
        # For non-SaaS deploys one may want a different use_case_id here
        # This keeps our internal schema consistent with the launch
        # of performance metrics
        use_case_id=None,
        internal_metrics_tag="release-health",
    ),
    "performance": MetricsIngestConfiguration(
        name="performance",
        input_topic=settings.KAFKA_INGEST_PERFORMANCE_METRICS,
        output_topic=settings.KAFKA_SNUBA_GENERIC_METRICS,
        use_case_id="performance",
        internal_metrics_tag="perf",
    ),
}


def get_ingest_config(environment_key="SENTRY_METRICS_INGEST_PROFILE"):
    return _METRICS_INGEST_CONFIG[os.environ.get(environment_key, "release-health")]
