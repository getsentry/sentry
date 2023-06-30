import logging

import msgpack
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.types import Message

from sentry.ingest.ingest_consumer import (
    IngestMessage,
    process_attachment_chunk,
    process_event,
    process_individual_attachment,
    process_userreport,
)
from sentry.models import Project
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def process_ingest_message(raw_message: Message[KafkaPayload]) -> None:
    """
    Processes a single Kafka Message containing an Event payload.

    This does:
    - Decode the Kafka payload which is in msgpack format and has a bit of
      metadata like `type` and `project_id`.
    - Fetch the corresponding Project from cache.
    - Further processing by `type`:
    ...
    For "event":
    - Decode the actual event payload which is in JSON format and perform some
      initial loadshedding on it.
    - Store the JSON payload in the event processing store, and pass it on to
      `preprocess_event`, which will schedule a followup task such as
      `symbolicate_event` or `process_event`.
    """

    raw_payload = raw_message.payload.value
    message: IngestMessage = msgpack.unpackb(raw_payload, use_list=False)

    message_type = message["type"]
    project_id = message["project_id"]
    project = None

    if message_type != "attachment_chunk":
        try:
            with metrics.timer("ingest_consumer.fetch_project"):
                project = Project.objects.get_from_cache(id=project_id)
        except Project.DoesNotExist:
            logger.error("Project for ingested event does not exist: %s", project_id)
            return

    if message_type == "event":
        process_event(message, project)
    elif message_type == "attachment_chunk":
        process_attachment_chunk(message)
    elif message_type == "attachment":
        process_individual_attachment(message, project)
    elif message_type == "user_report":
        process_userreport(message, project)
    else:
        raise ValueError(f"Unknown message type: {message_type}")
