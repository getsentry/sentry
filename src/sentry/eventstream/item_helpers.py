from collections.abc import Mapping
from typing import Any

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.request_common_pb2 import TRACE_ITEM_TYPE_OCCURRENCE
from sentry_protos.snuba.v1.trace_item_pb2 import AnyValue, TraceItem

from sentry.models.project import Project
from sentry.services.eventstore.models import Event, GroupEvent


def serialize_event_data_as_item(
    event: Event | GroupEvent, event_data: Mapping[str, Any], project: Project
) -> TraceItem:
    return TraceItem(
        item_id=event_data["event_id"].encode("utf-8"),
        item_type=TRACE_ITEM_TYPE_OCCURRENCE,
        trace_id=event_data["contexts"]["trace"]["trace_id"],
        timestamp=Timestamp(seconds=int(event_data["timestamp"])),
        organization_id=project.organization_id,
        project_id=project.id,
        received=(
            Timestamp(seconds=int(event_data["received"])) if "received" in event_data else None
        ),
        retention_days=event_data.get("retention_days", 90),
        attributes=encode_attributes(event, event_data, ignore_fields={"event_id", "timestamp"}),
    )


def encode_attributes(
    event: Event | GroupEvent, event_data: Mapping[str, Any], ignore_fields: set[str] | None = None
) -> Mapping[str, AnyValue]:
    attributes = {}
    ignore_fields = ignore_fields or set()

    for key, value in event_data.items():
        if key in ignore_fields:
            continue
        if isinstance(value, str):
            attributes[key] = AnyValue(string_value=value)
        elif isinstance(value, int):
            attributes[key] = AnyValue(int_value=value)
        elif isinstance(value, float):
            attributes[key] = AnyValue(double_value=value)
        elif isinstance(value, bool):
            attributes[key] = AnyValue(bool_value=value)
        elif isinstance(value, list):
            # TODO: FIX
            attributes[key] = AnyValue(int_value=-1)
        elif isinstance(value, dict):
            # TODO: FIX
            attributes[key] = AnyValue(int_value=-1)

    if event.group_id:
        attributes["group_id"] = AnyValue(int_value=event.group_id)

    return attributes
