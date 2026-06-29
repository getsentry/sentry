import msgspec
import orjson
import pytest

from sentry.spans.consumers.process.factory import decode_process_span_event


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


def test_decode_returns_struct_fields() -> None:
    event = decode_process_span_event(orjson.dumps(_valid_span()))

    assert event.organization_id == 1
    assert event.project_id == 12
    assert event.trace_id == "b" * 32
    assert event.span_id == "a" * 16
    assert event.parent_span_id == "c" * 16
    assert event.start_timestamp == 1699999999.0
    assert event.end_timestamp == 1700000000.0
    assert event.received == 1700000001.0
    assert event.retention_days == 90
    assert event.name == "test-span"
    assert event.status == "ok"
    assert event.is_segment is False


def test_decode_ignores_unknown_fields() -> None:
    # Unknown top-level keys and unmodeled attributes are skipped, not an error.
    payload = _valid_span(event_id="d" * 32, links=[{"trace_id": "e" * 32}], extra="ignored")
    event = decode_process_span_event(orjson.dumps(payload))
    assert event.trace_id == "b" * 32


def test_decode_extracts_segment_id() -> None:
    event = decode_process_span_event(orjson.dumps(_valid_span()))
    assert event.segment_id == "a" * 16


def test_decode_without_segment_id_attribute() -> None:
    event = decode_process_span_event(
        orjson.dumps(_valid_span(attributes={"some.other.attr": {"type": "integer", "value": 1}}))
    )
    assert event.segment_id is None


def test_decode_without_attributes() -> None:
    payload = _valid_span()
    del payload["attributes"]
    event = decode_process_span_event(orjson.dumps(payload))

    assert event.attributes is None
    assert event.segment_id is None


@pytest.mark.parametrize("parent_span_id", ["c" * 16, None])
@pytest.mark.parametrize("is_segment", [True, False, None])
def test_is_segment_span(parent_span_id: str | None, is_segment: bool | None) -> None:
    event = decode_process_span_event(
        orjson.dumps(_valid_span(parent_span_id=parent_span_id, is_segment=is_segment))
    )
    assert event.is_segment_span == (parent_span_id is None or bool(is_segment))


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


def test_decode_tolerates_missing_name() -> None:
    # `name` is nullable in the schema and Relay may omit the key. A missing
    # `name` decodes to None rather than raising.
    payload = _valid_span()
    del payload["name"]

    event = decode_process_span_event(orjson.dumps(payload))
    assert event.name is None


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
    event = decode_process_span_event(
        orjson.dumps(_valid_span(start_timestamp=1699999999, end_timestamp=1700000000))
    )
    assert event.start_timestamp == 1699999999.0
    assert event.end_timestamp == 1700000000.0


def test_optional_fields_default_when_absent() -> None:
    payload = _valid_span()
    del payload["parent_span_id"]
    del payload["is_segment"]

    event = decode_process_span_event(orjson.dumps(payload))
    assert event.parent_span_id is None
    assert event.is_segment is None
