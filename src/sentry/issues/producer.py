from __future__ import annotations

import logging
from collections.abc import MutableMapping
from typing import Any, cast

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from arroyo.types import Message, Value
from confluent_kafka import KafkaException
from django.conf import settings

from sentry.conf.types.kafka_definition import Topic
from sentry.hybridcloud.rpc import ValueEqualityEnum
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.run import process_message
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.utils import json
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger(__name__)


class PayloadType(ValueEqualityEnum):
    """
    Defines the type of payload that is being sent to Kafka.

    Messages without PayloadTypes default to OCCURRENCE.
    When adding new types, existing tests must pass without modifying the payload_type or the payload for backwards compatibility.
    """

    OCCURRENCE = "occurrence"
    STATUS_CHANGE = "status_change"


def _get_occurrence_producer() -> KafkaProducer:
    cluster_name = get_topic_definition(Topic.INGEST_OCCURRENCES)["cluster"]
    producer_config = get_kafka_producer_cluster_options(cluster_name)
    producer_config.pop("compression.type", None)
    producer_config.pop("message.max.bytes", None)
    return KafkaProducer(build_kafka_configuration(default_config=producer_config))


_occurrence_producer = SingletonProducer(
    _get_occurrence_producer, max_futures=settings.SENTRY_ISSUE_PLATFORM_FUTURES_MAX_LIMIT
)


def produce_occurrence_to_kafka(
    payload_type: PayloadType = PayloadType.OCCURRENCE,
    occurrence: IssueOccurrence | None = None,
    status_change: StatusChangeMessage | None = None,
    event_data: dict[str, Any] | None = None,
    is_buffered_spans: bool | None = False,
) -> None:
    if payload_type == PayloadType.OCCURRENCE:
        payload_data = _prepare_occurrence_message(occurrence, event_data, is_buffered_spans)
    elif payload_type == PayloadType.STATUS_CHANGE:
        payload_data = _prepare_status_change_message(status_change)
    else:
        raise NotImplementedError(f"Unknown payload type: {payload_type}")

    if payload_data is None:
        return

    partition_key = None
    if occurrence and occurrence.fingerprint:
        partition_key = f"{occurrence.fingerprint[0]}-{occurrence.project_id}".encode()
    elif status_change and status_change.fingerprint:
        partition_key = f"{status_change.fingerprint[0]}-{status_change.project_id}".encode()
    payload = KafkaPayload(partition_key, json.dumps(payload_data).encode("utf-8"), [])
    if settings.SENTRY_EVENTSTREAM != "sentry.eventstream.kafka.KafkaEventStream":
        # If we're not running Kafka then we're just in dev.
        # Skip producing to Kafka and just process the message directly
        process_message(Message(Value(payload=payload, committable={})))
        return

    try:
        topic = get_topic_definition(Topic.INGEST_OCCURRENCES)["real_topic_name"]
        _occurrence_producer.produce(ArroyoTopic(topic), payload)
    except KafkaException:
        logger.exception(
            "Failed to send occurrence to issue platform",
            extra={
                "id": payload_data["id"],
                "type": payload_data["type"],
                "issue_title": payload_data["issue_title"],
            },
        )


def _prepare_occurrence_message(
    occurrence: IssueOccurrence | None,
    event_data: dict[str, Any] | None,
    is_buffered_spans: bool | None = False,
) -> MutableMapping[str, Any] | None:
    if not occurrence:
        raise ValueError("occurrence must be provided")
    if event_data and occurrence.event_id != event_data["event_id"]:
        raise ValueError("Event id on occurrence and event_data must be the same")

    payload_data = cast(MutableMapping[str, Any], occurrence.to_dict())
    payload_data["payload_type"] = PayloadType.OCCURRENCE.value
    if event_data:
        payload_data["event"] = event_data

    if is_buffered_spans:
        payload_data["is_buffered_spans"] = True

    return payload_data


def _prepare_status_change_message(
    status_change: StatusChangeMessage | None,
) -> MutableMapping[str, Any] | None:
    if not status_change:
        raise ValueError("status_change must be provided")

    payload_data = cast(MutableMapping[str, Any], status_change.to_dict())
    payload_data["payload_type"] = PayloadType.STATUS_CHANGE.value
    return payload_data
