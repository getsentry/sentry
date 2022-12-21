import logging
from typing import Any, Dict, Mapping, Optional, Tuple

import rapidjson
from arroyo import Topic
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.backends.kafka.consumer import KafkaConsumer, KafkaPayload
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing.processor import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import Commit, Message, Partition
from django.conf import settings

from sentry.event_manager import GroupInfo
from sentry.eventstore.models import Event
from sentry.issues.ingest import save_issue_occurrence
from sentry.issues.issue_occurrence import IssueOccurrence, IssueOccurrenceData
from sentry.utils import json, metrics
from sentry.utils.canonical import CanonicalKeyDict
from sentry.utils.kafka_config import get_kafka_consumer_cluster_options

logger = logging.getLogger(__name__)


def get_occurrences_ingest_consumer(
    consumer_type: str,
) -> StreamProcessor[KafkaPayload]:
    return create_ingest_occurences_consumer(consumer_type)


def create_ingest_occurences_consumer(
    topic_name: str, **options: Any
) -> StreamProcessor[KafkaPayload]:

    consumer = KafkaConsumer(
        build_kafka_consumer_configuration(
            get_kafka_consumer_cluster_options(settings.KAFKA_TOPICS[topic_name]["cluster"]),
            auto_offset_reset="latest",
            group_id="occurrence-consumer",
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


def process_event_and_issue_occurrence(
    occurrence_data: IssueOccurrenceData, event_data: Dict[str, Any]
) -> Optional[Tuple[IssueOccurrence, Optional[GroupInfo]]]:
    try:
        event = save_event_from_occurrence(event_data)
    except Exception:
        logger.exception("error saving event")
        return None

    occurrence_data["event_id"] = event.event_id
    try:
        return save_issue_occurrence(occurrence_data, event)
    except Exception:
        logger.exception("error saving occurrence")

    return None


def _get_kwargs(payload: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    try:
        with metrics.timer("occurrence_ingest.duration", instance="_get_kwargs"):
            metrics.timing("occurrence.ingest.size.data", len(payload))

            kwargs = {
                "occurrence_data": {
                    "id": payload["id"],
                    "fingerprint": payload["fingerprint"],
                    "issue_title": payload["issue_title"],
                    "subtitle": payload["subtitle"],
                    "resource_id": payload.get("resource_id"),
                    "evidence_data": payload.get("evidence_data"),
                    "evidence_display": payload.get("evidence_display"),
                    "type": payload["type"],
                    "detection_time": payload["detection_time"],
                }
            }
            if "event_id" in payload:
                kwargs["occurrence_data"]["event_id"] = payload["event_id"]

            if "event" in payload:
                payload_event = payload["event"]
                kwargs["event_data"] = {
                    "event_id": payload_event["event_id"],
                    "project_id": payload_event["project_id"],
                    "platform": payload_event["platform"],
                    "tags": payload_event["tags"],
                    "timestamp": payload_event["timestamp"],
                    # TODO add other params as per the spec
                }
                kwargs["occurrence_data"]["event_id"] = payload_event["event_id"]

            return kwargs

    except (KeyError, ValueError):
        logger.exception("invalid payload data")
        return None


def _process_message(
    message: Mapping[str, Any]
) -> Optional[Tuple[IssueOccurrence, Optional[GroupInfo]]]:
    kwargs = _get_kwargs(message)
    if not kwargs:
        return None

    metrics.incr("occurrence_ingest.messages", sample_rate=1.0)

    if "event_data" in kwargs:
        return process_event_and_issue_occurrence(**kwargs)  # returning this now for easier testing
    else:
        # all occurrences will have Event data, for now
        pass

    return None


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
