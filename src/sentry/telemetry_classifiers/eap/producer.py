from __future__ import annotations

import math
import uuid
from collections.abc import Mapping
from datetime import datetime

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from django.utils import timezone
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_kafka_schemas.codecs import Codec
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry import options
from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.models.project import Project
from sentry.search.eap.rpc_utils import anyvalue
from sentry.utils.arroyo_producer import get_arroyo_producer, get_future_tracking_producer
from sentry.utils.eap import hex_to_item_id
from sentry.utils.kafka_config import get_topic_definition

type EnrichmentAttributeValue = (
    str | bool | int | float | list[str] | list[bool] | list[int] | list[float]
)

# UUIDv5 combines this namespace with each idempotency key to create deterministic item IDs.
# It is not a Kafka namespace or secret. Changing it changes every item ID and breaks retry
# idempotency; it provides collision isolation, not security.
ENRICHMENT_NAMESPACE = uuid.UUID("98bf1b4e-0a58-426f-81f5-fe27689fde74")
_EAP_WRITE_ENABLED = "telemetry-classifiers.eap-write.enabled"
_SNUBA_ITEMS_CODEC: Codec[TraceItem] = get_topic_codec(Topic.SNUBA_ITEMS)
_snuba_items_topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"])


def _get_snuba_items_producer() -> KafkaProducer:
    return get_arroyo_producer(
        name="sentry.telemetry_classifiers.eap.snuba_items",
        topic=Topic.SNUBA_ITEMS,
    )


_snuba_items_producer = get_future_tracking_producer(
    producer_name="sentry.telemetry_classifiers.eap.snuba_items",
    producer_factory=_get_snuba_items_producer,
)


def _sample_rate(name: str, value: float) -> float:
    if isinstance(value, bool) or not math.isfinite(value) or not 0 < value <= 1:
        raise ValueError(f"{name} must be greater than 0 and at most 1")
    return float(value)


def _timestamp(value: datetime) -> Timestamp:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("timestamp must be timezone-aware")
    timestamp = Timestamp()
    timestamp.FromDatetime(value)
    return timestamp


def produce_enrichment_attributes(
    project: Project,
    *,
    idempotency_key: str,
    trace_id: str,
    timestamp: datetime,
    retention_days: int,
    attributes: Mapping[str, EnrichmentAttributeValue],
    conversation_id: str | None = None,
    client_sample_rate: float = 1.0,
    server_sample_rate: float = 1.0,
) -> None:
    """Publish classifier attributes to EAP.

    Callers must derive the idempotency key and timestamp from stable source data so task retries
    replace the same EAP item.
    """
    if not options.get(_EAP_WRITE_ENABLED):
        return

    if not idempotency_key:
        raise ValueError("idempotency_key must not be empty")

    normalized_trace_id = uuid.UUID(trace_id).hex
    item_id = uuid.uuid5(
        ENRICHMENT_NAMESPACE,
        f"{project.organization_id}:{project.id}:{idempotency_key}",
    )

    trace_item = TraceItem(
        organization_id=project.organization_id,
        project_id=project.id,
        item_id=hex_to_item_id(item_id.hex),
        item_type=TraceItemType.TRACE_ITEM_TYPE_ENRICHMENT_ATTRIBUTES,
        timestamp=_timestamp(timestamp),
        received=_timestamp(timezone.now()),
        trace_id=normalized_trace_id,
        conversation_id=conversation_id or "",
        retention_days=retention_days,
        downsampled_retention_days=retention_days,
        attributes={key: anyvalue(value) for key, value in attributes.items()},
        client_sample_rate=_sample_rate("client_sample_rate", client_sample_rate),
        server_sample_rate=_sample_rate("server_sample_rate", server_sample_rate),
    )
    # Adding headers let consumers route items without decoding the full protobuf message
    # E.g. they can decide to skip processing item if it doesn't match specific item_type
    payload = KafkaPayload(
        None,
        _SNUBA_ITEMS_CODEC.encode(trace_item),
        [
            ("item_type", str(trace_item.item_type).encode("ascii")),
            ("project_id", str(project.id).encode("ascii")),
        ],
    )
    _snuba_items_producer.produce(_snuba_items_topic, payload)
