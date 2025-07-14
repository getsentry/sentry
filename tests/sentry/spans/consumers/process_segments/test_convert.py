from typing import cast

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import AnyValue, ArrayValue, KeyValue, KeyValueList

from sentry.spans.consumers.process_segments.convert import convert_span_to_item
from sentry.spans.consumers.process_segments.enrichment import Span

###############################################
# Test ported from Snuba's `eap_items_span`. #
###############################################

SPAN_KAFKA_MESSAGE = {
    "description": "/api/0/relays/projectconfigs/",
    "duration_ms": 152,
    "exclusive_time_ms": 0.228,
    "is_segment": True,
    "data": {
        "sentry.environment": "development",
        "sentry.release": "backend@24.7.0.dev0+c45b49caed1e5fcbf70097ab3f434b487c359b6b",
        "thread.name": "uWSGIWorker1Core0",
        "thread.id": "8522009600",
        "sentry.segment.name": "/api/0/relays/projectconfigs/",
        "sentry.sdk.name": "sentry.python.django",
        "sentry.sdk.version": "2.7.0",
        "my.float.field": 101.2,
        "my.int.field": 2000,
        "my.neg.field": -100,
        "my.neg.float.field": -101.2,
        "my.true.bool.field": True,
        "my.false.bool.field": False,
        "my.dict.field": {
            "id": 42,
            "name": "test",
        },
        "my.u64.field": 9447000002305251000,
        "my.array.field": [1, 2, ["nested", "array"]],
    },
    "measurements": {
        "num_of_spans": {"value": 50.0},
        "client_sample_rate": {"value": 0.1},
        "server_sample_rate": {"value": 0.2},
    },
    "profile_id": "56c7d1401ea14ad7b4ac86de46baebae",
    "organization_id": 1,
    "origin": "auto.http.django",
    "project_id": 1,
    "received": 1721319572.877828,
    "retention_days": 90,
    "segment_id": "8873a98879faf06d",
    "sentry_tags": {
        "description": "normalized_description",
        "category": "http",
        "environment": "development",
        "op": "http.server",
        "platform": "python",
        "release": "backend@24.7.0.dev0+c45b49caed1e5fcbf70097ab3f434b487c359b6b",
        "sdk.name": "sentry.python.django",
        "sdk.version": "2.7.0",
        "status": "ok",
        "status_code": "200",
        "thread.id": "8522009600",
        "thread.name": "uWSGIWorker1Core0",
        "trace.status": "ok",
        "transaction": "/api/0/relays/projectconfigs/",
        "transaction.method": "POST",
        "transaction.op": "http.server",
        "user": "ip:127.0.0.1",
    },
    "span_id": "8873a98879faf06d",
    "tags": {
        "http.status_code": "200",
        "relay_endpoint_version": "3",
        "relay_id": "88888888-4444-4444-8444-cccccccccccc",
        "relay_no_cache": "False",
        "relay_protocol_version": "3",
        "relay_use_post_or_schedule": "True",
        "relay_use_post_or_schedule_rejected": "version",
        "server_name": "D23CXQ4GK2.local",
        "spans_over_limit": "False",
    },
    "trace_id": "d099bf9ad5a143cf8f83a98081d0ed3b",
    "start_timestamp_ms": 1721319572616,
    "start_timestamp_precise": 1721319572.616648,
    "end_timestamp_precise": 1721319572.768806,
}


def test_convert_span_to_item():
    # Cast since the above payload does not conform to the strict schema
    item = convert_span_to_item(cast(Span, SPAN_KAFKA_MESSAGE))

    assert item.organization_id == 1
    assert item.project_id == 1
    assert item.trace_id == "d099bf9ad5a143cf8f83a98081d0ed3b"
    assert item.item_id == b"\x6d\xf0\xfa\x79\x88\xa9\x73\x88\x00\x00\x00\x00\x00\x00\x00\x00"
    assert item.item_type == TraceItemType.TRACE_ITEM_TYPE_SPAN
    assert item.timestamp == Timestamp(seconds=1721319572, nanos=616648000)
    assert item.client_sample_rate == 0.1
    assert item.server_sample_rate == 0.2
    assert item.retention_days == 90
    assert item.received == Timestamp(seconds=1721319572, nanos=877828000)

    assert item.attributes == {
        "my.false.bool.field": AnyValue(bool_value=False),
        "my.true.bool.field": AnyValue(bool_value=True),
        "sentry.is_segment": AnyValue(bool_value=True),
        "my.float.field": AnyValue(double_value=101.2),
        "my.neg.float.field": AnyValue(double_value=-101.2),
        "sentry.exclusive_time_ms": AnyValue(double_value=0.228),
        "sentry.start_timestamp_precise": AnyValue(double_value=1721319572.616648),
        "num_of_spans": AnyValue(double_value=50.0),
        "sentry.end_timestamp_precise": AnyValue(double_value=1721319572.768806),
        "sentry.duration_ms": AnyValue(int_value=152),
        "sentry.received": AnyValue(double_value=1721319572.877828),
        "my.int.field": AnyValue(int_value=2000),
        "my.neg.field": AnyValue(int_value=-100),
        "relay_protocol_version": AnyValue(string_value="3"),
        "sentry.raw_description": AnyValue(string_value="/api/0/relays/projectconfigs/"),
        "sentry.segment_id": AnyValue(string_value="8873a98879faf06d"),
        "sentry.transaction.method": AnyValue(string_value="POST"),
        "server_name": AnyValue(string_value="D23CXQ4GK2.local"),
        "sentry.status": AnyValue(string_value="ok"),
        "relay_endpoint_version": AnyValue(string_value="3"),
        "relay_no_cache": AnyValue(string_value="False"),
        "relay_use_post_or_schedule": AnyValue(string_value="True"),
        "spans_over_limit": AnyValue(string_value="False"),
        "sentry.segment.name": AnyValue(string_value="/api/0/relays/projectconfigs/"),
        "sentry.status_code": AnyValue(string_value="200"),
        "sentry.op": AnyValue(string_value="http.server"),
        "sentry.origin": AnyValue(string_value="auto.http.django"),
        "sentry.transaction": AnyValue(string_value="/api/0/relays/projectconfigs/"),
        "sentry.thread.name": AnyValue(string_value="uWSGIWorker1Core0"),
        "sentry.profile_id": AnyValue(string_value="56c7d1401ea14ad7b4ac86de46baebae"),
        "thread.id": AnyValue(string_value="8522009600"),
        "http.status_code": AnyValue(string_value="200"),
        "sentry.release": AnyValue(
            string_value="backend@24.7.0.dev0+c45b49caed1e5fcbf70097ab3f434b487c359b6b"
        ),
        "sentry.sdk.name": AnyValue(string_value="sentry.python.django"),
        "sentry.transaction.op": AnyValue(string_value="http.server"),
        "relay_id": AnyValue(string_value="88888888-4444-4444-8444-cccccccccccc"),
        "sentry.trace.status": AnyValue(string_value="ok"),
        "sentry.category": AnyValue(string_value="http"),
        "sentry.environment": AnyValue(string_value="development"),
        "sentry.thread.id": AnyValue(string_value="8522009600"),
        "sentry.sdk.version": AnyValue(string_value="2.7.0"),
        "sentry.platform": AnyValue(string_value="python"),
        "sentry.user": AnyValue(string_value="ip:127.0.0.1"),
        "relay_use_post_or_schedule_rejected": AnyValue(string_value="version"),
        "sentry.normalized_description": AnyValue(string_value="normalized_description"),
        "thread.name": AnyValue(string_value="uWSGIWorker1Core0"),
        "my.dict.field": AnyValue(
            kvlist_value=KeyValueList(
                values=[
                    KeyValue(key="id", value=AnyValue(int_value=42)),
                    KeyValue(key="name", value=AnyValue(string_value="test")),
                ]
            )
        ),
        "my.u64.field": AnyValue(double_value=9447000002305251000.0),
        "my.array.field": AnyValue(
            array_value=ArrayValue(
                values=[
                    AnyValue(int_value=1),
                    AnyValue(int_value=2),
                    AnyValue(
                        array_value=ArrayValue(
                            values=[AnyValue(string_value="nested"), AnyValue(string_value="array")]
                        )
                    ),
                ]
            )
        ),
    }


def test_convert_falsy_fields():
    message = {**SPAN_KAFKA_MESSAGE, "duration_ms": 0, "is_segment": False}

    item = convert_span_to_item(cast(Span, message))

    assert item.attributes.get("sentry.duration_ms") == AnyValue(int_value=0)
    assert item.attributes.get("sentry.is_segment") == AnyValue(bool_value=False)
