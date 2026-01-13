from typing import Any, cast

import orjson
import sentry_sdk
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_conventions.attributes import ATTRIBUTE_NAMES
from sentry_kafka_schemas.schema_types.buffered_segments_v1 import SpanLink
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import (
    AnyValue,
    ArrayValue,
    KeyValue,
    KeyValueList,
    TraceItem,
)

from sentry.spans.consumers.process_segments.types import CompatibleSpan
from sentry.utils.eap import hex_to_item_id

I64_MAX = 2**63 - 1

FIELD_TO_ATTRIBUTE = {
    "end_timestamp": "sentry.end_timestamp_precise",
    "event_id": "sentry.event_id",
    "hash": "sentry.hash",
    "name": "sentry.name",
    "parent_span_id": "sentry.parent_span_id",
    "received": "sentry.received",
    "start_timestamp": "sentry.start_timestamp_precise",
}

RENAME_ATTRIBUTES = {
    ATTRIBUTE_NAMES.SENTRY_DESCRIPTION: "sentry.raw_description",
    ATTRIBUTE_NAMES.SENTRY_SEGMENT_ID: "sentry.segment_id",
}


def convert_span_to_item(span: CompatibleSpan) -> TraceItem:
    attributes: dict[str, AnyValue] = {}

    client_sample_rate = 1.0
    server_sample_rate = 1.0

    for k, attribute in (span.get("attributes") or {}).items():
        if attribute is None:
            continue
        if (value := attribute.get("value")) is None:
            continue
        try:
            # NOTE: This ignores the `type` field of the attribute itself
            attributes[k] = _anyvalue(value)
        except Exception:
            sentry_sdk.capture_exception()
        else:
            if k == ATTRIBUTE_NAMES.SENTRY_CLIENT_SAMPLE_RATE:
                try:
                    client_sample_rate = float(value)  # type:ignore[arg-type]
                except ValueError:
                    pass
            elif k == ATTRIBUTE_NAMES.SENTRY_SERVER_SAMPLE_RATE:
                try:
                    server_sample_rate = float(value)  # type:ignore[arg-type]
                except ValueError:
                    pass

    # For `is_segment`, we trust the value written by `flush_segments` over a pre-existing attribute:
    if (is_segment := span.get("is_segment")) is not None:
        attributes["sentry.is_segment"] = _anyvalue(is_segment)

    for field_name, attribute_name in FIELD_TO_ATTRIBUTE.items():
        attribute = span.get(field_name)  # type:ignore[assignment]
        if attribute is not None:
            attributes[attribute_name] = _anyvalue(attribute)

    # Rename some attributes from their sentry-conventions name to what the product currently expects.
    # Eventually this should all be handled by deprecation policies in sentry-conventions.
    for convention_name, eap_name in RENAME_ATTRIBUTES.items():
        if convention_name in attributes:
            attributes[eap_name] = attributes.pop(convention_name)

    try:
        attributes["sentry.duration_ms"] = AnyValue(
            int_value=int(1000 * (span["end_timestamp"] - span["start_timestamp"]))
        )
    except Exception:
        sentry_sdk.capture_exception()

    if span_meta := span.get("_meta"):
        for attr, meta in (span_meta.get("attributes") or {}).items():
            try:
                if attr in RENAME_ATTRIBUTES:
                    attr = RENAME_ATTRIBUTES[attr]
                # Meta is expected to be a stringified json object.
                value = orjson.dumps({"meta": meta}).decode()
                attributes[f"sentry._meta.fields.attributes.{attr}"] = _anyvalue(value)
            except Exception:
                sentry_sdk.capture_exception()

    if links := span.get("links"):
        try:
            sanitized_links = [_sanitize_span_link(link) for link in links if link is not None]
            # Span links are expected to be a stringified json object.
            value = orjson.dumps(sanitized_links).decode()
            attributes["sentry.links"] = _anyvalue(value)
        except Exception:
            sentry_sdk.capture_exception()
            attributes["sentry.dropped_links_count"] = AnyValue(int_value=len(links))

    return TraceItem(
        organization_id=span["organization_id"],
        project_id=span["project_id"],
        trace_id=span["trace_id"],
        item_id=hex_to_item_id(span["span_id"]),
        item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
        timestamp=_timestamp(span["start_timestamp"]),
        attributes=attributes,
        client_sample_rate=client_sample_rate,
        server_sample_rate=server_sample_rate,
        retention_days=span["retention_days"],
        downsampled_retention_days=span.get("downsampled_retention_days", 0),
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
        return AnyValue(array_value=ArrayValue(values=[_anyvalue(v) for v in value]))
    elif isinstance(value, dict):
        return AnyValue(
            kvlist_value=KeyValueList(
                values=[KeyValue(key=k, value=_anyvalue(v)) for k, v in value.items()]
            )
        )

    raise ValueError(f"Unknown value type: {type(value)}")


def _timestamp(value: float) -> Timestamp:
    return Timestamp(
        seconds=int(value),
        nanos=round((value % 1) * 1_000_000) * 1000,
    )


ALLOWED_LINK_ATTRIBUTE_KEYS = ["sentry.link.type", "sentry.dropped_attributes_count"]


def _sanitize_span_link(link: SpanLink) -> SpanLink:
    """
    Prepares a span link for storage in EAP. EAP does not support array
    attributes, so span links are stored as a JSON-encoded string. In order to
    prevent unbounded storage, we only support well-known attributes.
    """

    sanitized_link = cast(SpanLink, {**link})

    allowed_attributes = {}
    attributes = link.get("attributes") or {}

    # In the future, we want Relay to drop unsupported attributes, so there
    # might be an intermediary state where there is a pre-existing dropped
    # attributes count. Respect that count, if it's present. It should always be
    # an integer.
    try:
        dropped_attributes_count = int(attributes["sentry.dropped_attributes_count"]["value"])  # type: ignore[index,arg-type]
    except (KeyError, ValueError, TypeError):
        dropped_attributes_count = 0

    for key, value in attributes.items():
        if key in ALLOWED_LINK_ATTRIBUTE_KEYS:
            allowed_attributes[key] = value
        else:
            dropped_attributes_count += 1

    if dropped_attributes_count > 0:
        allowed_attributes["sentry.dropped_attributes_count"] = {
            "type": "integer",
            "value": dropped_attributes_count,
        }

    # Only include the `attributes` key if the key was present in the original
    # link, don't create a an empty object, since there is a semantic difference
    # between missing attributes, and an empty attributes object
    if "attributes" in link:
        sanitized_link["attributes"] = allowed_attributes

    return sanitized_link
