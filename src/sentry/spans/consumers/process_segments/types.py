from typing import NotRequired

from sentry_kafka_schemas.schema_types.buffered_segments_v1 import SegmentSpan

# The default span.op to assume if it is missing on the span. This should be
# normalized by Relay, but we defensively apply the same fallback as the op is
# not guaranteed in typing.
DEFAULT_SPAN_OP = "default"


def get_span_op(span: SegmentSpan) -> str:
    return span.get("data", {}).get("sentry.op") or DEFAULT_SPAN_OP


class EnrichedSpan(SegmentSpan, total=True):
    """
    Enriched version of the incoming span payload that has additional attributes
    extracted from its child spans and/or inherited from its parent span.
    """

    exclusive_time_ms: float


class CompatibleSpan(EnrichedSpan, total=True):
    """A span that has the same fields as a kafka span, plus shimming for logic shared with the event pipeline.

    This type will be removed eventually."""

    exclusive_time: float
    op: str

    # Added by `SpanGroupingResults.write_to_spans` in `_enrich_spans`
    hash: NotRequired[str]
