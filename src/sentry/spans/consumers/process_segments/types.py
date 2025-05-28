from typing import NotRequired

from sentry_kafka_schemas.schema_types.buffered_segments_v1 import MeasurementValue
from sentry_kafka_schemas.schema_types.buffered_segments_v1 import SegmentSpan as UnprocessedSpan

__all__ = (
    "MeasurementValue",
    "Span",
    "UnprocessedSpan",
)


class Span(UnprocessedSpan, total=True):
    """
    Enriched version of the incoming span payload that has additional attributes
    extracted.
    """

    # Added in enrichment
    exclusive_time: float
    exclusive_time_ms: float
    op: str
    hash: NotRequired[str]
