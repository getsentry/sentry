from collections.abc import Mapping
from typing import Any

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.request_common_pb2 import TRACE_ITEM_TYPE_OCCURRENCE
from sentry_protos.snuba.v1.trace_item_pb2 import (
    AnyValue,
    ArrayValue,
    KeyValue,
    KeyValueList,
    TraceItem,
)

from sentry.models.project import Project
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.utils import json
from sentry.utils.eap import hex_to_item_id

# Max depth for recursive encoding to protobuf AnyValue.
_ENCODE_MAX_DEPTH = 6


def serialize_event_data_as_item(
    event: Event | GroupEvent, event_data: Mapping[str, Any], project: Project
) -> TraceItem:
    return TraceItem(
        item_id=hex_to_item_id(event_data["event_id"]),
        item_type=TRACE_ITEM_TYPE_OCCURRENCE,
        trace_id=event_data["contexts"]["trace"]["trace_id"],
        timestamp=Timestamp(seconds=int(event_data["timestamp"])),
        organization_id=project.organization_id,
        project_id=project.id,
        received=(
            Timestamp(seconds=int(event_data["received"])) if "received" in event_data else None
        ),
        retention_days=event_data.get("retention_days", 90),
        attributes=encode_attributes(
            event, event_data, ignore_fields={"event_id", "timestamp", "tags", "spans", "'spans'"}
        ),
    )


def encode_attributes(
    event: Event | GroupEvent, event_data: Mapping[str, Any], ignore_fields: set[str] | None = None
) -> Mapping[str, AnyValue]:
    tags_dict: dict[str, str] = {}
    raw_tags = event_data.get("tags")
    if raw_tags is not None:
        for tag in raw_tags:
            if tag is None:
                continue
            key, value = tag
            if value is None:
                continue
            tags_dict[key] = value

    all_ignore = (ignore_fields or set()) | {"tags"}
    attributes = build_occurrence_attributes(event_data, tags=tags_dict, ignore_fields=all_ignore)

    if event.group_id:
        attributes["group_id"] = AnyValue(int_value=event.group_id)

    return attributes


def build_occurrence_attributes(
    data: Mapping[str, Any],
    tags: Mapping[str, str] | None = None,
    ignore_fields: set[str] | None = None,
) -> dict[str, AnyValue]:
    attributes: dict[str, AnyValue] = {}
    ignore = ignore_fields or set()

    for key, value in data.items():
        if key in ignore:
            continue
        if value is None:
            continue
        attributes[key] = _encode_value(value)

    tag_keys: list[str] = []
    if tags:
        for key, value in tags.items():
            formatted_key = f"tags[{key}]"
            attributes[formatted_key] = _encode_value(value)
            tag_keys.append(formatted_key)
    attributes["tag_keys"] = _encode_value(sorted(tag_keys))

    return attributes


def _encode_value(value: Any, _depth: int = 0) -> AnyValue:
    if _depth > _ENCODE_MAX_DEPTH:
        # Beyond max depth, stringify to prevent protobuf nesting limit errors.
        return AnyValue(string_value=json.dumps(value))

    if isinstance(value, str):
        return AnyValue(string_value=value)
    elif isinstance(value, bool):
        # Note: bool check must come before int check since bool is a subclass of int
        return AnyValue(bool_value=value)
    elif isinstance(value, int):
        # int_value is a signed int64, so it has a range of valid values.
        # if value doesn't fit into an int64, cast it to string.
        if abs(value) >= (2**63):
            return AnyValue(string_value=str(value))
        return AnyValue(int_value=value)
    elif isinstance(value, float):
        return AnyValue(double_value=value)
    elif isinstance(value, list) or isinstance(value, tuple):
        # Not yet processed on EAP side
        return AnyValue(
            array_value=ArrayValue(
                values=[_encode_value(v, _depth + 1) for v in value if v is not None]
            )
        )
    elif isinstance(value, dict):
        # Not yet processed on EAP side
        return AnyValue(
            kvlist_value=KeyValueList(
                values=[
                    KeyValue(key=str(kv[0]), value=_encode_value(kv[1], _depth + 1))
                    for kv in value.items()
                    if kv[1] is not None
                ]
            )
        )
    else:
        raise NotImplementedError(f"encode not supported for {type(value)}")
