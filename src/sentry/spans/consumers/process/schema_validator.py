from typing import cast

from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.ingest_spans_v1 import SpanEvent

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.options.rollout import in_random_rollout
from sentry.spans.consumers.process_segments.types import attribute_value

PROCESS_SPANS_CODEC: Codec[SpanEvent] = get_topic_codec(Topic.INGEST_SPANS)


class ProcessSpansSchemaValidator:
    """
    ProcessSpansSchemaValidator class implements schema validation for spans. It checks whether
    the span is valid based on the schema validation rules. All messages that do not conform to the
    schema validation rules are discarded.

    There are several other assertions to protect against downstream crashes, see also: INC-1453, INC-1458.
    """

    def __init__(self) -> None:
        self._codec = PROCESS_SPANS_CODEC

    def validate(self, message: SpanEvent) -> None:
        if in_random_rollout("spans.process-segments.schema-validation"):
            self._codec.validate(message)
        assert isinstance(message["trace_id"], str)
        assert isinstance(message["span_id"], str)
        assert isinstance(message["start_timestamp"], (int, float))
        assert isinstance(message["end_timestamp"], (int, float))
        segment_id = cast(str | None, attribute_value(message, "sentry.segment.id"))
        assert segment_id is None or isinstance(segment_id, str)
