from sentry_kafka_schemas.schema_types.ingest_metrics_v1 import IngestMetric
from typing_extensions import Required

from sentry.sentry_metrics.use_case_id_registry import UseCaseID


class ParsedMessage(IngestMetric):
    """Internal representation of a parsed ingest metric message for indexer to support generic metrics"""

    use_case_id: Required[UseCaseID]
