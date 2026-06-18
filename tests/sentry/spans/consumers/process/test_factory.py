from typing import cast

import msgspec
import orjson
import pytest
from sentry_kafka_schemas.schema_types.ingest_spans_v1 import SpanEvent

from sentry.spans.consumers.process.factory import (
    SPANS_CODEC,
    ProcessSpanEvent,
    decode_process_span_event,
)
from sentry.spans.consumers.process_segments.types import attribute_value


def _valid_span(**overrides: object) -> dict[str, object]:
    span: dict[str, object] = {
        "organization_id": 1,
        "project_id": 12,
        "trace_id": "b" * 32,
        "span_id": "a" * 16,
        "parent_span_id": "c" * 16,
        "start_timestamp": 1699999999.0,
        "end_timestamp": 1700000000.0,
        "received": 1700000001.0,
        "retention_days": 90,
        "name": "test-span",
        "status": "ok",
        "is_segment": False,
        "attributes": {
            "sentry.segment.id": {"type": "string", "value": "a" * 16},
            "some.other.attr": {"type": "integer", "value": 42},
        },
    }
    span.update(overrides)
    return span


def test_decode_returns_minimum_fields() -> None:
    result = decode_process_span_event(orjson.dumps(_valid_span()))

    assert result == {
        "organization_id": 1,
        "project_id": 12,
        "trace_id": "b" * 32,
        "span_id": "a" * 16,
        "parent_span_id": "c" * 16,
        "start_timestamp": 1699999999.0,
        "end_timestamp": 1700000000.0,
        "received": 1700000001.0,
        "retention_days": 90,
        "name": "test-span",
        "status": "ok",
        "is_segment": False,
        "attributes": {"sentry.segment.id": {"type": "string", "value": "a" * 16}},
    }


def test_decode_output_passes_schema_validation() -> None:
    # The reconstructed event must satisfy the ingest-spans schema so that
    # `validate_span_event` does not crash the consumer.
    result = decode_process_span_event(orjson.dumps(_valid_span()))
    SPANS_CODEC.validate(cast(SpanEvent, result))


def test_decode_ignores_unknown_top_level_fields() -> None:
    payload = _valid_span(event_id="d" * 32, links=[{"trace_id": "e" * 32}], extra="ignored")
    result = decode_process_span_event(orjson.dumps(payload))

    assert "event_id" not in result
    assert "links" not in result
    assert "extra" not in result
    assert result["trace_id"] == "b" * 32


def test_decode_extracts_segment_id() -> None:
    result = decode_process_span_event(orjson.dumps(_valid_span()))
    assert attribute_value(result, "sentry.segment.id") == "a" * 16


def test_decode_without_segment_id_attribute() -> None:
    result = decode_process_span_event(
        orjson.dumps(_valid_span(attributes={"some.other.attr": {"type": "integer", "value": 1}}))
    )
    # Attribute is omitted entirely rather than emitted as an invalid entry.
    assert result["attributes"] == {}
    assert attribute_value(result, "sentry.segment.id") is None
    SPANS_CODEC.validate(cast(SpanEvent, result))


def test_decode_without_attributes() -> None:
    payload = _valid_span()
    del payload["attributes"]
    result = decode_process_span_event(orjson.dumps(payload))

    assert result["attributes"] == {}
    assert attribute_value(result, "sentry.segment.id") is None
    SPANS_CODEC.validate(cast(SpanEvent, result))


@pytest.mark.parametrize(
    "missing_field",
    [
        "organization_id",
        "project_id",
        "trace_id",
        "span_id",
        "start_timestamp",
        "end_timestamp",
        "received",
        "retention_days",
        "status",
    ],
)
def test_decode_raises_on_missing_required_field(missing_field: str) -> None:
    payload = _valid_span()
    del payload[missing_field]

    with pytest.raises(msgspec.ValidationError):
        decode_process_span_event(orjson.dumps(payload))


@pytest.mark.parametrize(
    "field,bad_value",
    [
        ("trace_id", 123),
        ("span_id", None),
        ("start_timestamp", "not-a-number"),
        ("status", None),
    ],
)
def test_decode_raises_on_wrong_type(field: str, bad_value: object) -> None:
    with pytest.raises(msgspec.ValidationError):
        decode_process_span_event(orjson.dumps(_valid_span(**{field: bad_value})))


def test_decode_coerces_integer_timestamps() -> None:
    # JSON numbers without a fractional part decode into the float fields.
    result = decode_process_span_event(
        orjson.dumps(_valid_span(start_timestamp=1699999999, end_timestamp=1700000000))
    )
    assert result["start_timestamp"] == 1699999999.0
    assert result["end_timestamp"] == 1700000000.0


def test_optional_fields_default_when_absent() -> None:
    payload = _valid_span()
    del payload["parent_span_id"]
    del payload["is_segment"]

    event = msgspec.json.decode(orjson.dumps(payload), type=ProcessSpanEvent)
    assert event.parent_span_id is None
    assert event.is_segment is None
