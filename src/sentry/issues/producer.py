from __future__ import annotations

import logging
from typing import Any, Dict, MutableMapping, Optional, cast

from arroyo import Topic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from arroyo.types import Message, Value
from django.conf import settings

from sentry import features
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.run import process_message
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.project import Project
from sentry.services.hybrid_cloud import ValueEqualityEnum
from sentry.utils import json
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger(__name__)


class PayloadType(ValueEqualityEnum):
    OCCURRENCE = "occurrence"
    STATUS_CHANGE = "status_change"


def _get_occurrence_producer() -> KafkaProducer:
    cluster_name = get_topic_definition(settings.KAFKA_INGEST_OCCURRENCES)["cluster"]
    producer_config = get_kafka_producer_cluster_options(cluster_name)
    producer_config.pop("compression.type", None)
    producer_config.pop("message.max.bytes", None)
    return KafkaProducer(build_kafka_configuration(default_config=producer_config))


_occurrence_producer = SingletonProducer(
    _get_occurrence_producer, max_futures=settings.SENTRY_ISSUE_PLATFORM_FUTURES_MAX_LIMIT
)


def produce_occurrence_to_kafka(
    payload_type: PayloadType | None = PayloadType.OCCURRENCE,
    occurrence: IssueOccurrence | None = None,
    status_change: StatusChangeMessage | None = None,
    event_data: Optional[Dict[str, Any]] = None,
) -> None:
    payload_data = None
    if payload_type == PayloadType.OCCURRENCE:
        payload_data = _prepare_occurrence_message(occurrence, event_data)
    elif payload_type == PayloadType.STATUS_CHANGE:
        payload_data = _prepare_status_change_message(status_change)
    else:
        raise NotImplementedError(f"Unknown payload type: {payload_type}")

    if payload_data is None:
        return

    payload = KafkaPayload(None, json.dumps(payload_data).encode("utf-8"), [])
    if settings.SENTRY_EVENTSTREAM != "sentry.eventstream.kafka.KafkaEventStream":
        # If we're not running Kafka then we're just in dev.
        # Skip producing to Kafka and just process the message directly
        process_message(Message(Value(payload=payload, committable={})))
        return

    _occurrence_producer.produce(Topic(settings.KAFKA_INGEST_OCCURRENCES), payload)


def _prepare_occurrence_message(
    occurrence: IssueOccurrence | None, event_data: Optional[Dict[str, Any]]
) -> MutableMapping[str, Any] | None:
    if not occurrence:
        raise ValueError("occurrence must be provided")
    if event_data and occurrence.event_id != event_data["event_id"]:
        raise ValueError("Event id on occurrence and event_data must be the same")

    payload_data = cast(MutableMapping[str, Any], occurrence.to_dict())
    payload_data["payload_type"] = PayloadType.OCCURRENCE.value
    if event_data:
        payload_data["event"] = event_data

    return payload_data


def _prepare_status_change_message(
    status_change: StatusChangeMessage | None,
) -> MutableMapping[str, Any] | None:
    if not status_change:
        raise ValueError("status_change must be provided")

    organization = Project.objects.get(id=status_change.project_id).organization
    if not features.has("organizations:issue-platform-api-crons-sd", organization):
        return None

    payload_data = cast(MutableMapping[str, Any], status_change.to_dict())
    payload_data["payload_type"] = PayloadType.STATUS_CHANGE.value
    return payload_data
