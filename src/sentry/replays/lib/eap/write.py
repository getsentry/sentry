from datetime import datetime
from typing import TypedDict

import requests
from django.conf import settings
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem as EAPTraceItem

from sentry.replays.lib.eap.snuba_transpiler import TRACE_ITEM_TYPES


class TraceItem(TypedDict):
    attributes: dict[str, bool | float | int | None | str]
    client_sample_rate: float
    organization_id: int
    project_id: int
    received: datetime
    retention_days: int
    server_sample_rate: float
    timestamp: datetime
    trace_id: str
    trace_item_id: bytes
    trace_item_type: TRACE_ITEM_TYPES


def new_trace_item(trace_item: TraceItem) -> EAPTraceItem:
    timestamp = Timestamp()
    timestamp.FromDatetime(trace_item["timestamp"])

    received = Timestamp()
    received.FromDatetime(trace_item["received"])

    return EAPTraceItem(
        organization_id=trace_item["organization_id"],
        project_id=trace_item["project_id"],
        item_type=trace_item["trace_item_type"],
        timestamp=timestamp,
        trace_id=trace_item["trace_id"],
        item_id=trace_item["trace_item_id"],
        received=received,
        retention_days=trace_item["retention_days"],
        attributes=trace_item["attributes"],
        client_sample_rate=trace_item["client_sample_rate"],
        server_sample_rate=trace_item["server_sample_rate"],
    )


def test_suite_insert_trace_items(trace_items: list[EAPTraceItem]) -> None:
    """Insert a trace-item for use within the test-suite."""
    response = requests.post(
        settings.SENTRY_SNUBA + "/tests/entities/eap_items/insert_bytes",
        files={
            f"item_{i}": trace_item.SerializeToString() for i, trace_item in enumerate(trace_items)
        },
    )
    assert response.status_code == 200
