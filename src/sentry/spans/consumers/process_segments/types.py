from typing import Any, NotRequired

from sentry_kafka_schemas.schema_types.buffered_segments_v1 import SegmentSpan as UnprocessedSpan

__all__ = (
    "Span",
    "UnprocessedSpan",
)


class Span(UnprocessedSpan, total=True):
    """
    Enriched version of the incoming span payload that has additional attributes
    extracted.
    """

    # Missing in schema
    start_timestamp_precise: float
    end_timestamp_precise: float
    data: NotRequired[dict[str, Any]]  # currently unused

    # Added in enrichment
    exclusive_time: float
    exclusive_time_ms: float
    op: str
    hash: NotRequired[str]
