import copy
from typing import cast

import orjson
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_kafka_schemas.schema_types.ingest_spans_v1 import SpanEvent
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import AnyValue, ArrayValue, KeyValue, KeyValueList

from sentry.spans.consumers.process_segments.convert import RENAME_ATTRIBUTES, convert_span_to_item
from sentry.spans.consumers.process_segments.types import CompatibleSpan

###############################################
# Test ported from Snuba's `eap_items_span`. #
###############################################

SPAN_KAFKA_MESSAGE: SpanEvent = {
    "is_segment": True,
    "attributes": {
        "http.status_code": {"value": "200", "type": "string"},
        "my.array.field": {"value": [1, 2, ["nested", "array"]], "type": "array"},
        "my.dict.field": {"value": {"id": 42, "name": "test"}, "type": "object"},
        "my.false.bool.field": {"value": False, "type": "boolean"},
        "my.float.field": {"value": 101.2, "type": "double"},
        "my.int.field": {"value": 2000, "type": "integer"},
        "my.neg.field": {"value": -100, "type": "integer"},
        "my.neg.float.field": {"value": -101.2, "type": "double"},
        "my.true.bool.field": {"value": True, "type": "boolean"},
        "my.u64.field": {"value": 9447000002305251000, "type": "integer"},
        "my.unested.array.field": {"value": [1, 2, 3, 4], "type": "array"},
        "my.invalid.field": None,
        "num_of_spans": {"value": 50.0, "type": "string"},
        "relay_endpoint_version": {"value": "3", "type": "string"},
        "relay_id": {"value": "88888888-4444-4444-8444-cccccccccccc", "type": "string"},
        "relay_no_cache": {"value": "False", "type": "string"},
        "relay_protocol_version": {"value": "3", "type": "string"},
        "relay_use_post_or_schedule": {"value": "True", "type": "string"},
        "relay_use_post_or_schedule_rejected": {"value": "version", "type": "string"},
        "sentry.category": {"value": "http", "type": "string"},
        "sentry.client_sample_rate": {"value": 0.1, "type": "string"},
        "sentry.description": {"value": "/api/0/relays/projectconfigs/", "type": "string"},
        "sentry.environment": {"value": "development", "type": "string"},
        "sentry.is_segment": {"value": True, "type": "boolean"},
        "sentry.normalized_description": {"value": "normalized_description", "type": "string"},
        "sentry.op": {"value": "http.server", "type": "string"},
        "sentry.origin": {"value": "auto.http.django", "type": "string"},
        "sentry.platform": {"value": "python", "type": "string"},
        "sentry.profile_id": {"value": "56c7d1401ea14ad7b4ac86de46baebae", "type": "string"},
        "sentry.release": {
            "value": "backend@24.7.0.dev0+c45b49caed1e5fcbf70097ab3f434b487c359b6b",
            "type": "string",
        },
        "sentry.sdk.name": {"value": "sentry.python.django", "type": "string"},
        "sentry.sdk.version": {"value": "2.7.0", "type": "string"},
        "sentry.segment.id": {"type": "string", "value": "8873a98879faf06d"},
        "sentry.segment.name": {"value": "/api/0/relays/projectconfigs/", "type": "string"},
        "sentry.server_sample_rate": {"value": 0.2, "type": "string"},
        "sentry.status": {"value": "ok", "type": "string"},
        "sentry.status_code": {"value": "200", "type": "string"},
        "sentry.thread.id": {"value": "8522009600", "type": "string"},
        "sentry.thread.name": {"value": "uWSGIWorker1Core0", "type": "string"},
        "sentry.trace.status": {"value": "ok", "type": "string"},
        "sentry.transaction": {"value": "/api/0/relays/projectconfigs/", "type": "string"},
        "sentry.transaction.method": {"value": "POST", "type": "string"},
        "sentry.transaction.op": {"value": "http.server", "type": "string"},
        "sentry.user": {"value": "ip:127.0.0.1", "type": "string"},
        "server_name": {"value": "D23CXQ4GK2.local", "type": "string"},
        "spans_over_limit": {"value": "False", "type": "string"},
        "thread.id": {"value": "8522009600", "type": "string"},
        "thread.name": {"value": "uWSGIWorker1Core0", "type": "string"},
    },
    "organization_id": 1,
    "project_id": 1,
    "received": 1721319572.877828,
    "retention_days": 90,
    "span_id": "8873a98879faf06d",
    "trace_id": "d099bf9ad5a143cf8f83a98081d0ed3b",
    "start_timestamp": 1721319572.616648,
    "end_timestamp": 1721319572.768806,
    "name": "endpoint",
    "status": "ok",
    "_meta": {
        "attributes": {
            "my.invalid.field": {
                "": {"err": ["invalid_data"], "val": {"type": "boolean", "value": True}}
            }
        }
    },
}


def test_convert_span_to_item() -> None:
    item = convert_span_to_item(cast(CompatibleSpan, SPAN_KAFKA_MESSAGE))

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

    # Sort for easier comparison:
    attrs = {k: v for (k, v) in sorted(item.attributes.items())}

    assert attrs == {
        "http.status_code": AnyValue(string_value="200"),
        "my.array.field": AnyValue(
            array_value=ArrayValue(
                values=[
                    AnyValue(int_value=1),
                    AnyValue(int_value=2),
                    AnyValue(
                        array_value=ArrayValue(
                            values=[
                                AnyValue(string_value="nested"),
                                AnyValue(string_value="array"),
                            ],
                        ),
                    ),
                ],
            ),
        ),
        "my.dict.field": AnyValue(
            kvlist_value=KeyValueList(
                values=[
                    KeyValue(key="id", value=AnyValue(int_value=42)),
                    KeyValue(key="name", value=AnyValue(string_value="test")),
                ],
            ),
        ),
        "my.false.bool.field": AnyValue(bool_value=False),
        "my.float.field": AnyValue(double_value=101.2),
        "my.int.field": AnyValue(int_value=2000),
        "my.neg.field": AnyValue(int_value=-100),
        "my.neg.float.field": AnyValue(double_value=-101.2),
        "my.true.bool.field": AnyValue(bool_value=True),
        "my.u64.field": AnyValue(double_value=9447000002305251000.0),
        "my.unested.array.field": AnyValue(
            array_value=ArrayValue(
                values=[
                    AnyValue(int_value=1),
                    AnyValue(int_value=2),
                    AnyValue(int_value=3),
                    AnyValue(int_value=4),
                ],
            ),
        ),
        "num_of_spans": AnyValue(double_value=50.0),
        "relay_endpoint_version": AnyValue(string_value="3"),
        "relay_id": AnyValue(string_value="88888888-4444-4444-8444-cccccccccccc"),
        "relay_no_cache": AnyValue(string_value="False"),
        "relay_protocol_version": AnyValue(string_value="3"),
        "relay_use_post_or_schedule_rejected": AnyValue(string_value="version"),
        "relay_use_post_or_schedule": AnyValue(string_value="True"),
        "sentry.category": AnyValue(string_value="http"),
        "sentry.client_sample_rate": AnyValue(double_value=0.1),
        "sentry.duration_ms": AnyValue(int_value=152),
        "sentry.end_timestamp_precise": AnyValue(double_value=1721319572.768806),
        "sentry.environment": AnyValue(string_value="development"),
        "sentry.is_segment": AnyValue(bool_value=True),
        "sentry.name": AnyValue(string_value="endpoint"),
        "sentry.normalized_description": AnyValue(string_value="normalized_description"),
        "sentry.op": AnyValue(string_value="http.server"),
        "sentry.origin": AnyValue(string_value="auto.http.django"),
        "sentry.platform": AnyValue(string_value="python"),
        "sentry.profile_id": AnyValue(string_value="56c7d1401ea14ad7b4ac86de46baebae"),
        "sentry.raw_description": AnyValue(string_value="/api/0/relays/projectconfigs/"),
        "sentry.received": AnyValue(double_value=1721319572.877828),
        "sentry.release": AnyValue(
            string_value="backend@24.7.0.dev0+c45b49caed1e5fcbf70097ab3f434b487c359b6b"
        ),
        "sentry.sdk.name": AnyValue(string_value="sentry.python.django"),
        "sentry.sdk.version": AnyValue(string_value="2.7.0"),
        "sentry.segment_id": AnyValue(string_value="8873a98879faf06d"),
        "sentry.segment.name": AnyValue(string_value="/api/0/relays/projectconfigs/"),
        "sentry.server_sample_rate": AnyValue(double_value=0.2),
        "sentry.start_timestamp_precise": AnyValue(double_value=1721319572.616648),
        "sentry.status_code": AnyValue(string_value="200"),
        "sentry.status": AnyValue(string_value="ok"),
        "sentry.thread.id": AnyValue(string_value="8522009600"),
        "sentry.thread.name": AnyValue(string_value="uWSGIWorker1Core0"),
        "sentry.trace.status": AnyValue(string_value="ok"),
        "sentry.transaction.method": AnyValue(string_value="POST"),
        "sentry.transaction.op": AnyValue(string_value="http.server"),
        "sentry.transaction": AnyValue(string_value="/api/0/relays/projectconfigs/"),
        "sentry.user": AnyValue(string_value="ip:127.0.0.1"),
        "server_name": AnyValue(string_value="D23CXQ4GK2.local"),
        "spans_over_limit": AnyValue(string_value="False"),
        "thread.id": AnyValue(string_value="8522009600"),
        "thread.name": AnyValue(string_value="uWSGIWorker1Core0"),
        "sentry._meta.fields.attributes.my.invalid.field": AnyValue(
            string_value=r"""{"meta":{"":{"err":["invalid_data"],"val":{"type":"boolean","value":true}}}}"""
        ),
    }


def test_convert_falsy_fields() -> None:
    message: SpanEvent = copy.deepcopy(SPAN_KAFKA_MESSAGE)
    message["is_segment"] = False

    item = convert_span_to_item(cast(CompatibleSpan, message))

    assert item.attributes.get("sentry.is_segment") == AnyValue(bool_value=False)


def test_convert_span_links_to_json() -> None:
    message: SpanEvent = copy.deepcopy(SPAN_KAFKA_MESSAGE)
    message["links"] = [
        # A link with all properties
        {
            "trace_id": "d099bf9ad5a143cf8f83a98081d0ed3b",
            "span_id": "8873a98879faf06d",
            "sampled": True,
            "attributes": {
                "sentry.link.type": {"type": "string", "value": "parent"},
                "sentry.dropped_attributes_count": {"type": "integer", "value": 2},
                "parent_depth": {"type": "integer", "value": 17},
                "confidence": {"type": "string", "value": "high"},
            },
        },
        # A link with missing optional properties
        {
            "trace_id": "d099bf9ad5a143cf8f83a98081d0ed3b",
            "span_id": "873a988879faf06d",
        },
    ]

    item = convert_span_to_item(cast(CompatibleSpan, message))

    assert item.attributes.get("sentry.links") == AnyValue(
        string_value='[{"trace_id":"d099bf9ad5a143cf8f83a98081d0ed3b","span_id":"8873a98879faf06d","sampled":true,"attributes":{"sentry.link.type":{"type":"string","value":"parent"},"sentry.dropped_attributes_count":{"type":"integer","value":4}}},{"trace_id":"d099bf9ad5a143cf8f83a98081d0ed3b","span_id":"873a988879faf06d"}]'
    )


def test_convert_renamed_attribute_meta() -> None:
    # precondition: make sure we're testing a renamed field
    assert "sentry.description" in RENAME_ATTRIBUTES

    message: SpanEvent = copy.deepcopy(SPAN_KAFKA_MESSAGE)
    description_meta = {"": {"err": ["invalid_data"], "val": {"type": "string", "value": True}}}
    message["_meta"]["attributes"]["sentry.description"] = description_meta

    item = convert_span_to_item(cast(CompatibleSpan, message))

    assert "sentry._meta.fields.attributes.sentry.description" not in item.attributes
    assert item.attributes.get("sentry._meta.fields.attributes.sentry.raw_description") == AnyValue(
        string_value=orjson.dumps({"meta": description_meta}).decode()
    )
