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
        attributes=_encode_attributes(
            event, event_data, ignore_fields={"event_id", "timestamp", "tags", "spans", "'spans'"}
        ),
    )


def _encode_attributes(
    event: Event | GroupEvent, event_data: Mapping[str, Any], ignore_fields: set[str] | None = None
) -> Mapping[str, AnyValue]:
    raw_tags = event_data.get("tags") or []
    tags_dict = {kv[0]: kv[1] for kv in raw_tags if kv is not None and kv[1] is not None}

    all_ignore_fields = (ignore_fields or set()) | {"tags"}
    attributes = _build_occurrence_attributes(
        event_data, tags=tags_dict, ignore_fields=all_ignore_fields
    )

    if event.group_id:
        attributes["group_id"] = AnyValue(int_value=event.group_id)

    return attributes


def _build_occurrence_attributes(
    data: Mapping[str, Any],
    tags: Mapping[str, str] | None = None,
    ignore_fields: set[str] | None = None,
) -> dict[str, AnyValue]:
    ignore_fields = ignore_fields or set()
    attributes: dict[str, AnyValue] = {
        k: _encode_value(v) for k, v in data.items() if k not in ignore_fields and v is not None
    }

    tag_attrs = {f"tags[{k}]": _encode_value(v) for k, v in (tags or {}).items()}
    attributes.update(tag_attrs)
    attributes["tag_keys"] = _encode_value(sorted(tag_attrs.keys()))

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
