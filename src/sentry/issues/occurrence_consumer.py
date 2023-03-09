import logging
from typing import Any, Dict, Mapping, Optional, Tuple
from uuid import UUID

import jsonschema
import rapidjson
import sentry_sdk
from arroyo import Topic
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.backends.kafka.consumer import KafkaConsumer, KafkaPayload
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing.processor import StreamProcessor
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
    RunTask,
)
from arroyo.types import Commit, Message, Partition
from django.conf import settings
from django.utils import timezone

from sentry import features, nodestore
from sentry.event_manager import GroupInfo
from sentry.eventstore.models import Event
from sentry.issues.grouptype import GroupCategory, get_group_types_by_category
from sentry.issues.ingest import save_issue_occurrence
from sentry.issues.issue_occurrence import DEFAULT_LEVEL, IssueOccurrence, IssueOccurrenceData
from sentry.issues.json_schemas import EVENT_PAYLOAD_SCHEMA
from sentry.models import Organization, Project
from sentry.utils import json, metrics
from sentry.utils.batching_kafka_consumer import create_topics
from sentry.utils.kafka_config import get_kafka_consumer_cluster_options

logger = logging.getLogger(__name__)


class InvalidEventPayloadError(Exception):
    pass


class EventLookupError(Exception):
    pass


def get_occurrences_ingest_consumer(
    consumer_type: str,
    auto_offset_reset: str,
    group_id: str,
    strict_offset_reset: bool,
) -> StreamProcessor[KafkaPayload]:
    return create_ingest_occurences_consumer(
        consumer_type, auto_offset_reset, group_id, strict_offset_reset
    )


def create_ingest_occurences_consumer(
    topic_name: str,
    auto_offset_reset: str,
    group_id: str,
    strict_offset_reset: bool,
) -> StreamProcessor[KafkaPayload]:
    kafka_cluster = settings.KAFKA_TOPICS[topic_name]["cluster"]
    create_topics(kafka_cluster, [topic_name])

    consumer = KafkaConsumer(
        build_kafka_consumer_configuration(
            get_kafka_consumer_cluster_options(kafka_cluster),
            auto_offset_reset=auto_offset_reset,
            group_id=group_id,
            strict_offset_reset=strict_offset_reset,
        )
    )

    strategy_factory = OccurrenceStrategyFactory()

    return StreamProcessor(
        consumer,
        Topic(topic_name),
        strategy_factory,
        ONCE_PER_SECOND,
    )


def save_event_from_occurrence(
    data: Dict[str, Any],
    **kwargs: Any,
) -> Event:

    from sentry.event_manager import EventManager

    data["type"] = "generic"

    project_id = data.pop("project_id")

    with metrics.timer("occurrence_consumer.save_event_occurrence.event_manager.save"):
        manager = EventManager(data, remove_other=False)
        event = manager.save(project_id=project_id)

        return event


def lookup_event(project_id: int, event_id: str) -> Event:
    data = nodestore.get(Event.generate_node_id(project_id, event_id))
    if data is None:
        raise EventLookupError(f"Failed to lookup event({event_id}) for project_id({project_id})")
    event = Event(event_id=event_id, project_id=project_id)
    event.data = data
    return event


def process_event_and_issue_occurrence(
    occurrence_data: IssueOccurrenceData, event_data: Dict[str, Any]
) -> Tuple[IssueOccurrence, Optional[GroupInfo]]:
    if occurrence_data["event_id"] != event_data["event_id"]:
        raise ValueError(
            f"event_id in occurrence({occurrence_data['event_id']}) is different from event_id in event_data({event_data['event_id']})"
        )

    event = save_event_from_occurrence(event_data)
    return save_issue_occurrence(occurrence_data, event)


def lookup_event_and_process_issue_occurrence(
    occurrence_data: IssueOccurrenceData,
) -> Tuple[IssueOccurrence, Optional[GroupInfo]]:
    project_id = occurrence_data["project_id"]
    event_id = occurrence_data["event_id"]
    try:
        event = lookup_event(project_id, event_id)
    except Exception:
        raise EventLookupError(f"Failed to lookup event({event_id}) for project_id({project_id})")

    return save_issue_occurrence(occurrence_data, event)


def _get_kwargs(payload: Mapping[str, Any]) -> Mapping[str, Any]:
    """
    Processes the incoming message payload into a format we can use.

    :raises InvalidEventPayloadError: when payload contains invalid data
    """
    try:
        with metrics.timer("occurrence_ingest.duration", instance="_get_kwargs"):
            metrics.timing("occurrence.ingest.size.data", len(payload))

            occurrence_data = {
                "id": UUID(payload["id"]).hex,
                "project_id": payload["project_id"],
                "fingerprint": payload["fingerprint"],
                "issue_title": payload["issue_title"],
                "subtitle": payload["subtitle"],
                "resource_id": payload.get("resource_id"),
                "evidence_data": payload.get("evidence_data"),
                "evidence_display": payload.get("evidence_display"),
                "type": payload["type"],
                "detection_time": payload["detection_time"],
                "level": payload.get("level", DEFAULT_LEVEL),
            }

            if payload.get("event_id"):
                occurrence_data["event_id"] = UUID(payload["event_id"]).hex

            if "event" in payload:
                event_payload = payload["event"]
                if payload["project_id"] != event_payload.get("project_id"):
                    raise InvalidEventPayloadError(
                        f"project_id in occurrence ({payload['project_id']}) is different from project_id in event ({event_payload.get('project_id')})"
                    )
                if not payload.get("event_id") and not event_payload.get("event_id"):
                    raise InvalidEventPayloadError("Payload must contain an event_id")

                if not payload.get("event_id"):
                    occurrence_data["event_id"] = event_payload.get("event_id")

                event_data = {
                    "event_id": UUID(event_payload.get("event_id")).hex,
                    "level": occurrence_data["level"],
                    "project_id": event_payload.get("project_id"),
                    "platform": event_payload.get("platform"),
                    "received": event_payload.get("received", timezone.now()),
                    "tags": event_payload.get("tags"),
                    "timestamp": event_payload.get("timestamp"),
                }

                optional_params = [
                    "breadcrumbs",
                    "contexts",
                    "debug_meta",
                    "dist",
                    "environment",
                    "extra",
                    "modules",
                    "release",
                    "request",
                    "sdk",
                    "server_name",
                    "stacktrace",
                    "trace_id",
                    "transaction",
                    "user",
                ]
                for optional_param in optional_params:
                    if optional_param in event_payload:
                        event_data[optional_param] = event_payload.get(optional_param)

                _validate_event_data(event_data)

                event_data["metadata"] = {
                    # This allows us to show the title consistently in discover
                    "title": occurrence_data["issue_title"],
                }

                return {"occurrence_data": occurrence_data, "event_data": event_data}
            else:
                if not payload.get("event_id"):
                    raise InvalidEventPayloadError(
                        "Payload must contain either event_id or event_data"
                    )

                return {"occurrence_data": occurrence_data}

    except (KeyError, ValueError) as e:
        raise InvalidEventPayloadError(e)


def _validate_event_data(event_data: Mapping[str, Any]) -> None:
    try:
        jsonschema.validate(event_data, EVENT_PAYLOAD_SCHEMA)
    except jsonschema.exceptions.ValidationError:
        metrics.incr("occurrence_ingest.event_payload_invalid")
        raise InvalidEventPayloadError("Event payload does not match schema")


def _process_message(
    message: Mapping[str, Any]
) -> Optional[Tuple[IssueOccurrence, Optional[GroupInfo]]]:
    """
    :raises InvalidEventPayloadError: when the message is invalid
    :raises EventLookupError: when the provided event_id in the message couldn't be found.
    """
    with sentry_sdk.start_transaction(
        op="_process_message",
        name="issues.occurrence_consumer",
        sampled=True,
    ) as txn:
        try:
            kwargs = _get_kwargs(message)
            occurrence_data = kwargs["occurrence_data"]
            metrics.incr(
                "occurrence_ingest.messages",
                sample_rate=1.0,
                tags={"occurrence_type": occurrence_data["type"]},
            )
            txn.set_tag("occurrence_type", occurrence_data["type"])

            project = Project.objects.get_from_cache(id=occurrence_data["project_id"])
            organization = Organization.objects.get_from_cache(id=project.organization_id)

            txn.set_tag("organization_id", organization.id)
            txn.set_tag("organization_slug", organization.slug)
            txn.set_tag("project_id", project.id)
            txn.set_tag("project_slug", project.slug)

            if occurrence_data["type"] not in get_group_types_by_category(
                GroupCategory.PROFILE.value
            ) or not features.has("organizations:profile-blocked-main-thread-ingest", organization):
                metrics.incr(
                    "occurrence_ingest.dropped_feature_disabled",
                    sample_rate=1.0,
                    tags={"occurrence_type": occurrence_data["type"]},
                )
                txn.set_tag("result", "dropped_feature_disabled")
                return None

            if "event_data" in kwargs:
                txn.set_tag("result", "success")
                return process_event_and_issue_occurrence(
                    kwargs["occurrence_data"], kwargs["event_data"]
                )
            else:
                txn.set_tag("result", "success")
                return lookup_event_and_process_issue_occurrence(kwargs["occurrence_data"])
        except (ValueError, KeyError) as e:
            txn.set_tag("result", "error")
            raise InvalidEventPayloadError(e)


class OccurrenceStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        def process_message(message: Message[KafkaPayload]) -> None:
            try:
                payload = json.loads(message.payload.value, use_rapid_json=True)
                _process_message(payload)
            except (
                rapidjson.JSONDecodeError,
                InvalidEventPayloadError,
                EventLookupError,
                Exception,
            ):
                logger.exception("failed to process message payload")

        return RunTask(process_message, CommitOffsets(commit))
