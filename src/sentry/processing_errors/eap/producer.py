from __future__ import annotations

import logging
import uuid
from collections.abc import Mapping, Sequence
from typing import TYPE_CHECKING, Any

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_kafka_schemas.codecs import Codec
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry import quotas
from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.search.eap.rpc_utils import anyvalue
from sentry.utils import metrics
from sentry.utils.arroyo_producer import SingletonProducer, get_arroyo_producer
from sentry.utils.eap import hex_to_item_id
from sentry.utils.kafka_config import get_topic_definition

if TYPE_CHECKING:
    from sentry.models.project import Project

logger = logging.getLogger(__name__)

PROCESSING_ERROR_NAMESPACE = uuid.UUID("a4d8f4e2-1b3c-4a9d-9e1f-5c2b1a0d7f6e")
EAP_ITEMS_CODEC: Codec[TraceItem] = get_topic_codec(Topic.SNUBA_ITEMS)


def _get_eap_items_producer() -> KafkaProducer:
    return get_arroyo_producer(
        name="sentry.processing_errors.eap.producer",
        topic=Topic.SNUBA_ITEMS,
    )


_eap_producer = SingletonProducer(_get_eap_items_producer)


def produce_processing_errors_to_eap(
    project: Project,
    event_data: Mapping[str, Any],
    processing_errors: Sequence[Mapping[str, Any]],
) -> None:
    """
    Produces processing errors as TraceItems to the EAP topic.

    Each processing error becomes one TraceItem with the error metadata
    stored as attributes. This enables querying processing errors in EAP
    for configuration issue detection.
    """
    trace_id = event_data.get("contexts", {}).get("trace", {}).get("trace_id")
    if trace_id is None:
        logger.debug("Skipping EAP processing error production: missing trace_id")
        return

    try:
        topic = get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"]
        timestamp = Timestamp(seconds=int(event_data["timestamp"]))
        retention_days = quotas.backend.get_event_retention(organization=project.organization) or 90

        release = event_data.get("release")
        environment = event_data.get("environment")
        platform = event_data.get("platform")
        sdk = event_data.get("sdk") or {}
        sdk_name = sdk.get("name")
        sdk_version = sdk.get("version")

        count = 0
        for index, error in enumerate(processing_errors):
            attributes: dict[str, Any] = {
                "event_id": event_data["event_id"],
                "error_type": error.get("type", "unknown"),
            }

            if "symbolicator_type" in error:
                attributes["symbolicator_type"] = error["symbolicator_type"]

            if release is not None:
                attributes["release"] = release

            if environment is not None:
                attributes["environment"] = environment

            if platform is not None:
                attributes["platform"] = platform

            if sdk_name is not None:
                attributes["sdk_name"] = sdk_name

            if sdk_version is not None:
                attributes["sdk_version"] = sdk_version

            item_id = hex_to_item_id(
                uuid.uuid5(PROCESSING_ERROR_NAMESPACE, f"{event_data['event_id']}:{index}").hex
            )

            trace_item = TraceItem(
                organization_id=project.organization_id,
                project_id=project.id,
                item_id=item_id,
                item_type=TraceItemType.TRACE_ITEM_TYPE_PROCESSING_ERROR,
                timestamp=timestamp,
                trace_id=trace_id,
                retention_days=retention_days,
                attributes={k: anyvalue(v) for k, v in attributes.items()},
                client_sample_rate=1.0,
                server_sample_rate=1.0,
            )

            payload = KafkaPayload(None, EAP_ITEMS_CODEC.encode(trace_item), [])
            _eap_producer.produce(ArroyoTopic(topic), payload)
            count += 1

        metrics.incr(
            "processing_errors.eap.produced",
            amount=count,
            sample_rate=1.0,
        )

    except Exception:
        logger.exception("Failed to produce processing errors to EAP")
        metrics.incr(
            "processing_errors.eap.produce_failed",
            sample_rate=1.0,
        )
