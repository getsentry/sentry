from collections.abc import Mapping
from typing import Any, NotRequired

from sentry_kafka_schemas.schema_types.ingest_spans_v1 import (
    SpanEvent,
    _FileColonIngestSpansFullStopV1FullStopSchemaFullStopJsonNumberSignDefinitionsAttributevalueObject,
)

Attributes = dict[
    str,
    None
    | _FileColonIngestSpansFullStopV1FullStopSchemaFullStopJsonNumberSignDefinitionsAttributevalueObject,
]


# The default span.op to assume if it is missing on the span. This should be
# normalized by Relay, but we defensively apply the same fallback as the op is
# not guaranteed in typing.
DEFAULT_SPAN_OP = "default"


def get_span_op(span: SpanEvent) -> str:
    return attribute_value(span, "sentry.op") or DEFAULT_SPAN_OP


class CompatibleSpan(SpanEvent, total=True):
    """A span that has the same fields as a kafka span, plus shimming for logic shared with the event pipeline.

    This type will be removed eventually."""

    exclusive_time: float
    op: str
    sentry_tags: dict[str, str]
    is_segment: bool

    # Added by `SpanGroupingResults.write_to_spans` in `_enrich_spans`
    hash: NotRequired[str]


def attribute_value(span: Mapping[str, Any], key: str) -> Any:
    attributes = span.get("attributes") or {}
    attr: dict[str, Any] = attributes.get(key) or {}
    return attr.get("value")
