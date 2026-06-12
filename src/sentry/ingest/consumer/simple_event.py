import logging

import msgpack
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.dlq import InvalidMessage
from arroyo.types import BrokerValue, Message
from taskbroker_client.constants import CompressionType
from taskbroker_client.retry import Retry

from sentry.ingest.types import ConsumerType
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import ingest_events_passthrough_tasks
from sentry.utils import metrics

from .processors import IngestMessage, Retriable, process_event

logger = logging.getLogger(__name__)


def process_simple_event_message(
    raw_message: Message[KafkaPayload],
    consumer_type: str,
    reprocess_only_stuck_events: bool,
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
            return

        return process_event(
            consumer_type,
            message,
            project,
            reprocess_only_stuck_events,
        )

    except Exception as exc:
        # If the retriable exception was raised, we should not DLQ
        if isinstance(exc, Retriable):
            raise

        raw_value = raw_message.value
        assert isinstance(raw_value, BrokerValue)
        raise InvalidMessage(raw_value.partition, raw_value.offset) from exc


@instrumented_task(
    name="sentry.ingest.consumer.simple_event.process_event_from_kafka",
    namespace=ingest_events_passthrough_tasks,
    processing_deadline_duration=60,
    retry=Retry(times=2, delay=5, on=(Retriable,)),
    compression_type=CompressionType.ZSTD,
    silo_mode=SiloMode.CELL,
)
def process_event_from_kafka(message_bytes: bytes) -> None:
    """Process an event from raw Kafka message bytes (taskbroker raw mode)."""
    metrics.distribution(
        "ingest_consumer.payload_size",
        len(message_bytes),
        tags={"consumer": ConsumerType.Events},
        unit="byte",
    )

    message: IngestMessage = msgpack.unpackb(message_bytes, use_list=False)

    message_type = message["type"]
    project_id = message["project_id"]

    if message_type != "event":
        raise ValueError(f"Unsupported message type: {message_type}")

    try:
        with metrics.timer("ingest_consumer.fetch_project"):
            project = Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        return

    return process_event(
        ConsumerType.Events,
        message,
        project,
        reprocess_only_stuck_events=False,
    )
