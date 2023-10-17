from __future__ import annotations

import logging
from typing import Any, Dict, MutableMapping, Optional, cast

from arroyo import Topic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from django.conf import settings

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.occurrence_status_change import OccurrenceStatusChange
from sentry.models.grouphash import GroupHash
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
    status_change: OccurrenceStatusChange | None = None,
    event_data: Optional[Dict[str, Any]] = None,
) -> None:
    if payload_type == PayloadType.OCCURRENCE:
        if not occurrence:
            raise ValueError("Occurrence must be provided")
        if event_data and occurrence.event_id != event_data["event_id"]:
            raise ValueError("Event id on occurrence and event_data must be the same")
        if settings.SENTRY_EVENTSTREAM != "sentry.eventstream.kafka.KafkaEventStream":
            # If we're not running Kafka then we're just in dev. Skip producing to Kafka and just
            # write to the issue platform directly
            from sentry.issues.occurrence_consumer import (
                lookup_event_and_process_issue_occurrence,
                process_event_and_issue_occurrence,
            )

            if event_data:
                process_event_and_issue_occurrence(occurrence.to_dict(), event_data)
            else:
                lookup_event_and_process_issue_occurrence(occurrence.to_dict())
            return
        payload_data = cast(MutableMapping[str, Any], occurrence.to_dict())
        if event_data:
            payload_data["event"] = event_data
        payload = KafkaPayload(None, json.dumps(payload_data).encode("utf-8"), [])
        _occurrence_producer.produce(Topic(settings.KAFKA_INGEST_OCCURRENCES), payload)
    elif payload_type == PayloadType.STATUS_CHANGE:
        if not status_change:
            raise ValueError("Status change must be provided")

        try:
            grouphash = (
                GroupHash.objects.filter(
                    project=status_change.project_id,
                    hash__in=status_change.fingerprint,  # assume single fingerprint
                )
                .select_related("group")
                .first()
            )
            if not grouphash:
                logger.error(
                    "grouphash.not_found",
                    extra={
                        "project_id": status_change.project_id,
                        "fingerprint": status_change.fingerprint,
                    },
                )
                return

            status_change.update_status_for_occurrence(grouphash.group)
        except GroupHash.DoesNotExist:
            logger.error(
                "grouphash.missing",
                extra={
                    "project_id": status_change.project_id,
                    "fingerprint": status_change.fingerprint,
                },
            )
            return
    else:
        raise NotImplementedError(f"Unknown payload type {payload_type}")
