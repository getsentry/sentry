import logging
from typing import Any, Dict, Mapping, Optional, Tuple

import jsonschema
import rapidjson
from arroyo import Topic
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.backends.kafka.consumer import KafkaConsumer, KafkaPayload
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing.processor import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import Commit, Message, Partition
from django.conf import settings
from django.utils import timezone

from sentry import nodestore
from sentry.event_manager import GroupInfo
from sentry.eventstore.models import Event
from sentry.issues.ingest import save_issue_occurrence
from sentry.issues.issue_occurrence import IssueOccurrence, IssueOccurrenceData
from sentry.issues.json_schemas import EVENT_PAYLOAD_SCHEMA
from sentry.utils import json, metrics
from sentry.utils.batching_kafka_consumer import create_topics
from sentry.utils.canonical import CanonicalKeyDict
from sentry.utils.kafka_config import get_kafka_consumer_cluster_options

logger = logging.getLogger(__name__)


class InvalidEventPayloadError(Exception):
    pass


class EventLookupError(Exception):
    pass


def get_occurrences_ingest_consumer(
    consumer_type: str,
    strict_offset_reset: bool,
) -> StreamProcessor[KafkaPayload]:
    return create_ingest_occurences_consumer(consumer_type, strict_offset_reset)


def create_ingest_occurences_consumer(
    topic_name: str,
    strict_offset_reset: bool,
) -> StreamProcessor[KafkaPayload]:
    kafka_cluster = settings.KAFKA_TOPICS[topic_name]["cluster"]
    create_topics(kafka_cluster, [topic_name])

    consumer = KafkaConsumer(
        build_kafka_consumer_configuration(
            get_kafka_consumer_cluster_options(kafka_cluster),
            auto_offset_reset="latest",
            group_id="occurrence-consumer",
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
    data = CanonicalKeyDict(data)

    with metrics.timer("occurrence_consumer.save_event_occurrence.event_manager.save"):
        manager = EventManager(data)
        event = manager.save(project_id=project_id)

        return event


def process_event(event_data: Dict[str, Any]) -> Optional[Event]:
    try:
        return save_event_from_occurrence(event_data)
    except Exception:
        logger.exception("error saving event")
        return None


def lookup_event(project_id: int, event_id: str) -> Event:
    data = nodestore.get(Event.generate_node_id(project_id, event_id))
    if data is None:
        raise EventLookupError(f"Failed to lookup event({event_id}) for project_id({project_id})")
    event = Event(event_id=event_id, project_id=project_id)
    event.data = data
    return event


def process_issue_occurrence(
    occurrence_data: IssueOccurrenceData, event: Event
) -> Optional[Tuple[IssueOccurrence, Optional[GroupInfo]]]:
    occurrence_data["event_id"] = event.event_id
    try:
        return save_issue_occurrence(occurrence_data, event)
    except Exception:
        logger.exception("error saving occurrence")

    return None


def process_event_and_issue_occurrence(
    occurrence_data: IssueOccurrenceData, event_data: Dict[str, Any]
) -> Optional[Tuple[IssueOccurrence, Optional[GroupInfo]]]:
    event = process_event(event_data)
    if event is None:
        return None

    return process_issue_occurrence(occurrence_data, event)


def lookup_event_and_process_issue_occurrence(
    occurrence_data: IssueOccurrenceData,
) -> Optional[Tuple[IssueOccurrence, Optional[GroupInfo]]]:
    project_id = occurrence_data["project_id"]
    event_id = occurrence_data["event_id"]
    try:
        event = lookup_event(project_id, event_id)
    except EventLookupError:
        raise
    except Exception:
        raise EventLookupError(f"Failed to lookup event({event_id}) for project_id({project_id})")
    if event is None:
        return None

    return process_issue_occurrence(occurrence_data, event)


def _get_kwargs(payload: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    try:
        with metrics.timer("occurrence_ingest.duration", instance="_get_kwargs"):
            metrics.timing("occurrence.ingest.size.data", len(payload))

            occurrence_data = {
                "id": payload["id"],
                "project_id": payload["project_id"],
                "fingerprint": payload["fingerprint"],
                "issue_title": payload["issue_title"],
                "subtitle": payload["subtitle"],
                "resource_id": payload.get("resource_id"),
                "evidence_data": payload.get("evidence_data"),
                "evidence_display": payload.get("evidence_display"),
                "type": payload["type"],
                "detection_time": payload["detection_time"],
                # TODO: need to parse level
            }

            if "event" in payload:
                event_payload = payload["event"]
                if payload["project_id"] != event_payload.get("project_id"):
                    raise InvalidEventPayloadError(
                        f"project_id in occurrence ({payload['project_id']}) is different from project_id in event ({event_payload.get('project_id')})"
                    )
                if not payload.get("event_id") and not event_payload.get("event_id"):
                    raise InvalidEventPayloadError("Payload must contain an event_id")

                if not payload.get("event_id") and event_payload.get("event_id"):
                    occurrence_data["event_id"] = event_payload.get("event_id")

                if occurrence_data.get("event_id") != event_payload.get("event_id"):
                    raise InvalidEventPayloadError(
                        f"Payload contains a mismatch event_id in occurrence({occurrence_data.get('event_id')}) and event_data({event_payload.get('event_id')})"
                    )

                event_data = {
                    "event_id": event_payload.get("event_id"),
                    "project_id": event_payload.get("project_id"),
                    "platform": event_payload.get("platform"),
                    "tags": event_payload.get("tags"),
                    "timestamp": event_payload.get("timestamp"),
                    "received": event_payload.get("received", timezone.now()),
                }

                optional_params = [
                    "breadcrumbs",
                    "contexts",
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

                return {"occurrence_data": occurrence_data, "event_data": event_data}
            else:
                if not payload.get("event_id"):
                    raise InvalidEventPayloadError(
                        "Payload must contain either event_id or event_data"
                    )
                occurrence_data["event_id"] = payload["event_id"]

                return {"occurrence_data": occurrence_data}

    except (KeyError, ValueError):
        logger.exception("invalid payload data")
        return None


def _validate_event_data(event_data: Mapping[str, Any]) -> None:
    try:
        jsonschema.validate(event_data, EVENT_PAYLOAD_SCHEMA)
    except jsonschema.exceptions.ValidationError:
        metrics.incr("occurrence_ingest.event_payload_invalid")
        raise InvalidEventPayloadError("Event payload does not match schema")


def _process_message(
    message: Mapping[str, Any]
) -> Optional[Tuple[IssueOccurrence, Optional[GroupInfo]]]:
    metrics.incr("occurrence_ingest.messages", sample_rate=1.0)

    try:
        kwargs = _get_kwargs(message)
    except InvalidEventPayloadError:
        kwargs = None

    if not kwargs:
        return None

    if "event_data" in kwargs:
        return process_event_and_issue_occurrence(kwargs["occurrence_data"], kwargs["event_data"])
    else:
        return lookup_event_and_process_issue_occurrence(kwargs["occurrence_data"])


class OccurrenceStrategy(ProcessingStrategy[KafkaPayload]):
    def __init__(
        self,
        committer: Commit,
        partitions: Mapping[Partition, int],
    ):
        pass

    def poll(self) -> None:
        pass

    def submit(self, message: Message[KafkaPayload]) -> None:
        try:
            payload = json.loads(message.payload.value, use_rapid_json=True)
            _process_message(payload)
        except rapidjson.JSONDecodeError:
            logger.exception("invalid json received")

    def close(self) -> None:
        pass

    def terminate(self) -> None:
        pass

    def join(self, timeout: Optional[float] = None) -> None:
        pass


class OccurrenceStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(self) -> None:
        pass

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return OccurrenceStrategy(commit, partitions)
