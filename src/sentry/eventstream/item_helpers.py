from collections.abc import Mapping
from typing import Any

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.request_common_pb2 import TRACE_ITEM_TYPE_OCCURRENCE
from sentry_protos.snuba.v1.trace_item_pb2 import AnyValue, TraceItem

from sentry.models.project import Project
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.utils.eap import encode_value


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
        attributes=encode_attributes(
            event, event_data, ignore_fields={"event_id", "timestamp", "tags"}
        ),
    )


def encode_attributes(
    event: Event | GroupEvent, event_data: Mapping[str, Any], ignore_fields: set[str] | None = None
) -> Mapping[str, AnyValue]:
    attributes = {}
    ignore_fields = ignore_fields or set()

    for key, value in event_data.items():
        if key in ignore_fields:
            continue
        if value is None:
            continue
        attributes[key] = encode_value(value)

    if event.group_id:
        attributes["group_id"] = AnyValue(int_value=event.group_id)

    for key, value in event_data["tags"]:
        if value is None:
            continue
        attributes[f"tags[{key}]"] = encode_value(value)

    return attributes
