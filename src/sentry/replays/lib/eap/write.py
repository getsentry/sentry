from collections.abc import MutableMapping, Sequence
from datetime import datetime
from typing import TypedDict

import requests
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload
from django.conf import settings
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.trace_item_pb2 import AnyValue, ArrayValue, KeyValue, KeyValueList
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem as EAPTraceItem

from sentry.conf.types.kafka_definition import Topic
from sentry.replays.lib.eap.snuba_transpiler import TRACE_ITEM_TYPE_MAP, TRACE_ITEM_TYPES
from sentry.replays.lib.kafka import EAP_ITEMS_CODEC, eap_producer
from sentry.utils.eap import EAP_ITEMS_INSERT_ENDPOINT
from sentry.utils.kafka_config import get_topic_definition

Value = bool | bytes | str | int | float | Sequence["Value"] | MutableMapping[str, "Value"]


class TraceItem(TypedDict):
    attributes: MutableMapping[str, Value]
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
    def _anyvalue(value: Value) -> AnyValue:
        if isinstance(value, bool):
            return AnyValue(bool_value=value)
        elif isinstance(value, str):
            return AnyValue(string_value=value)
        elif isinstance(value, int):
            return AnyValue(int_value=value)
        elif isinstance(value, float):
            return AnyValue(double_value=value)
        elif isinstance(value, bytes):
            return AnyValue(bytes_value=value)
        elif isinstance(value, list):
            return AnyValue(array_value=ArrayValue(values=[_anyvalue(v) for v in value]))
        elif isinstance(value, dict):
            return AnyValue(
                kvlist_value=KeyValueList(
                    values=[KeyValue(key=k, value=_anyvalue(v)) for k, v in value.items()]
                )
            )
        else:
            raise ValueError(f"Invalid value type for AnyValue: {type(value)}")

    timestamp = Timestamp()
    timestamp.FromDatetime(trace_item["timestamp"])

    received = Timestamp()
    received.FromDatetime(trace_item["received"])

    return EAPTraceItem(
        organization_id=trace_item["organization_id"],
        project_id=trace_item["project_id"],
        item_type=TRACE_ITEM_TYPE_MAP[trace_item["trace_item_type"]],
        timestamp=timestamp,
        trace_id=trace_item["trace_id"],
        item_id=trace_item["trace_item_id"],
        received=received,
        retention_days=trace_item["retention_days"],
        attributes={k: _anyvalue(v) for k, v in trace_item["attributes"].items()},
        client_sample_rate=trace_item["client_sample_rate"],
        server_sample_rate=trace_item["server_sample_rate"],
    )


def write_trace_items_test_suite(trace_items: list[EAPTraceItem]) -> None:
    """Insert a trace-item for use within the test-suite.

    Receiving connection errors when calling this function? Tail the Snuba logs and read the
    error message raised there. It's likely request parsing failed and you need to modify the
    payload you're sending.

        `docker logs -f snuba-snuba-1`
    """
    response = requests.post(
        settings.SENTRY_SNUBA + EAP_ITEMS_INSERT_ENDPOINT,
        files={
            f"item_{i}": trace_item.SerializeToString() for i, trace_item in enumerate(trace_items)
        },
    )
    assert response.status_code == 200


def write_trace_items(trace_items: list[EAPTraceItem]) -> None:
    """Publish trace-items to the EAP trace-items topic."""
    topic = get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"]
    for trace_item in trace_items:
        payload = KafkaPayload(None, EAP_ITEMS_CODEC.encode(trace_item), [])
        eap_producer.produce(ArroyoTopic(topic), payload)
