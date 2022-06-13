from dataclasses import dataclass
from typing import Mapping, Optional

from django.conf import settings


@dataclass(frozen=True)
class MetricsIngestConfiguration:
    input_topic: str
    output_topic: str
    use_case_id: Optional[str]
    internal_metrics_prefix: Optional[str]


METRICS_INGEST_CONFIG: Mapping[str, MetricsIngestConfiguration] = {
    "release-health": MetricsIngestConfiguration(
        input_topic=settings.KAFKA_INGEST_METRICS,
        output_topic=settings.KAFKA_SNUBA_METRICS,
        # For non-SaaS deploys one may want different values here
        # This keeps our internal metrics consistent on release of (newer)
        # performance helath metrics.
        use_case_id=None,
        internal_metrics_prefix=None,
    ),
    "performance": MetricsIngestConfiguration(
        input_topic=settings.KAFKA_INGEST_PERFORMANCE_METRICS,
        output_topic=settings.KAFKA_SNUBA_GENERIC_METRICS,
        use_case_id="performance",
        internal_metrics_prefix="perf",
    ),
}
