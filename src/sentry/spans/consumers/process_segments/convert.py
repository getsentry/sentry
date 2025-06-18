from collections.abc import MutableMapping
from typing import Any

import sentry_sdk
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import (
    AnyValue,
    ArrayValue,
    KeyValue,
    KeyValueList,
    TraceItem,
)

from sentry.spans.consumers.process_segments.enrichment import Span

I64_MAX = 2**63 - 1

FIELD_TO_ATTRIBUTE = {
    "description": "sentry.raw_description",
    "duration_ms": "sentry.duration_ms",
    "is_segment": "sentry.is_segment",
    "exclusive_time_ms": "sentry.exclusive_time_ms",
    "start_timestamp_precise": "sentry.start_timestamp_precise",
    "end_timestamp_precise": "sentry.end_timestamp_precise",
    "is_remote": "sentry.is_remote",
    "parent_span_id": "sentry.parent_span_id",
    "profile_id": "sentry.profile_id",
    "segment_id": "sentry.segment_id",
    "received": "sentry.received",
    "origin": "sentry.origin",
    "kind": "sentry.kind",
    "hash": "sentry.hash",
}


def convert_span_to_item(span: Span) -> TraceItem:
    attributes: MutableMapping[str, AnyValue] = {}  # TODO

    client_sample_rate = 1.0
    server_sample_rate = 1.0

    for k, v in (span.get("data") or {}).items():
        if v is not None:
            try:
                attributes[k] = _anyvalue(v)
            except Exception:
                sentry_sdk.capture_exception()

    for k, v in (span.get("measurements") or {}).items():
        if k is not None and v is not None:
            if k == "client_sample_rate":
                client_sample_rate = v["value"]
            elif k == "server_sample_rate":
                server_sample_rate = v["value"]
            else:
                attributes[k] = AnyValue(double_value=float(v["value"]))

    for k, v in (span.get("sentry_tags") or {}).items():
        if v is not None:
            if k == "description":
                k = "sentry.normalized_description"
            else:
                k = f"sentry.{k}"

            attributes[k] = AnyValue(string_value=str(v))

    for k, v in (span.get("tags") or {}).items():
        if v is not None:
            attributes[k] = AnyValue(string_value=str(v))

    for field_name, attribute_name in FIELD_TO_ATTRIBUTE.items():
        v = span.get(field_name)
        if v is not None:
            attributes[attribute_name] = _anyvalue(v)

    return TraceItem(
        organization_id=span["organization_id"],
        project_id=span["project_id"],
        trace_id=span["trace_id"],
        item_id=int(span["span_id"], 16).to_bytes(16, "little"),
        item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
        timestamp=_timestamp(span["start_timestamp_precise"]),
        attributes=attributes,
        client_sample_rate=client_sample_rate,
        server_sample_rate=server_sample_rate,
        retention_days=span["retention_days"],
        received=_timestamp(span["received"]),
    )


def _anyvalue(value: Any) -> AnyValue:
    if isinstance(value, str):
        return AnyValue(string_value=value)
    elif isinstance(value, bool):
        return AnyValue(bool_value=value)
    elif isinstance(value, int):
        if value > I64_MAX:
            return AnyValue(double_value=float(value))
        return AnyValue(int_value=value)
    elif isinstance(value, float):
        return AnyValue(double_value=value)
    elif isinstance(value, list):
        array_values = [_anyvalue(v) for v in value if v is not None]
        return AnyValue(array_value=ArrayValue(values=array_values))
    elif isinstance(value, dict):
        kv_values = [KeyValue(key=k, value=_anyvalue(v)) for k, v in value.items() if v is not None]
        return AnyValue(kvlist_value=KeyValueList(values=kv_values))

    raise ValueError(f"Unknown value type: {type(value)}")


def _timestamp(value: float) -> Timestamp:
    return Timestamp(
        seconds=int(value),
        nanos=round((value % 1) * 1_000_000) * 1000,
    )
