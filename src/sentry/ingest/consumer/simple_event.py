import logging

import msgpack
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.dlq import InvalidMessage
from arroyo.types import BrokerValue, Message

from sentry.conf.types.kafka_definition import Topic
from sentry.models.project import Project
from sentry.utils import metrics

from ..types import ConsumerType
from .processors import IngestMessage, Retriable, process_event

logger = logging.getLogger(__name__)


consumer_type_to_default_topic = {
    "events": Topic.INGEST_EVENTS,
    "transactions": Topic.INGEST_TRANSACTIONS,
    "attachments": Topic.INGEST_ATTACHMENTS,
    ConsumerType.Feedback: Topic.INGEST_FEEDBACK_EVENTS,
}


def process_simple_event_message(
    raw_message: Message[KafkaPayload], consumer_type: str, reprocess_only_stuck_events: bool
) -> None:
    """
    Processes a single Kafka Message containing a "simple" Event payload.

    This does:
    - Decode the Kafka payload which is in msgpack format and has a bit of
      metadata like `type` and `project_id`.
    - Fetch the corresponding Project from cache.
    - Decode the actual event payload which is in JSON format and perform some
      initial loadshedding on it.
    - Store the JSON payload in the event processing store, and pass it on to
      `preprocess_event`, which will schedule a followup task such as
      `symbolicate_event` or `process_event`.
    """

    raw_payload = raw_message.payload.value
    metrics.distribution(
        "ingest_consumer.payload_size",
        len(raw_payload),
        tags={"consumer": consumer_type},
        unit="byte",
    )

    try:
        message: IngestMessage = msgpack.unpackb(raw_payload, use_list=False)

        message_type = message["type"]
        project_id = message["project_id"]

        if message_type != "event":
            raise ValueError(f"Unsupported message type: {message_type}")

        try:
            with metrics.timer("ingest_consumer.fetch_project"):
                project = Project.objects.get_from_cache(id=project_id)
        except Project.DoesNotExist:
            logger.exception("Project for ingested event does not exist: %s", project_id)
            return

        return process_event(message, project, reprocess_only_stuck_events)

    except Exception as exc:
        # If the retriable exception was raised, we should not DLQ
        if isinstance(exc, Retriable):
            raise

        # TODO: Remove this line once all topics (transactions, attachments,
        # user feedback) also have DLQs
        default_topic = consumer_type_to_default_topic[consumer_type].value
        topics_with_dlqs = [
            Topic.INGEST_EVENTS,
            Topic.INGEST_FEEDBACK_EVENTS,
        ]
        if default_topic not in topics_with_dlqs:
            raise

        raw_value = raw_message.value
        assert isinstance(raw_value, BrokerValue)
        raise InvalidMessage(raw_value.partition, raw_value.offset) from exc
