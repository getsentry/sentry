from __future__ import annotations

import logging

import msgpack
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.types import Message

from sentry.models.project import Project
from sentry.utils import metrics

from .processors import (
    IngestMessage,
    process_attachment_chunk,
    process_event,
    process_individual_attachment,
    process_userreport,
)

logger = logging.getLogger(__name__)


def decode_and_process_chunks(
    raw_message: Message[KafkaPayload],
) -> IngestMessage | None:
    """
    The first pass for the `attachments` topic:

    - Decode the Kafka payload which is in msgpack format and has a bit of
      metadata like `type` and `project_id`.
    - Process and save `attachment_chunk`s.
    """
    raw_payload = raw_message.payload.value
    message: IngestMessage = msgpack.unpackb(raw_payload, use_list=False)

    if message["type"] == "attachment_chunk":
        process_attachment_chunk(message)
        return None

    return message


def process_attachments_and_events(raw_message: Message[IngestMessage]) -> None:
    """
    The second pass for the `attachments` topic processes *individual* `attachments`
    which are not needed for event processing, and the `event` itself,
    as all attachment chunks those two need have been processed already.

    This will:
    - Decode the actual event payload which is in JSON format and perform some
      initial loadshedding on it.
    - Store the JSON payload in the event processing store, and pass it on to
      `preprocess_event`, which will schedule a followup task such as
      `symbolicate_event` or `process_event`.
    """
    message = raw_message.payload
    message_type = message["type"]
    project_id = message["project_id"]

    try:
        with metrics.timer("ingest_consumer.fetch_project"):
            project = Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        logger.exception("Project for ingested event does not exist: %s", project_id)
        return None

    if message_type == "attachment":
        process_individual_attachment(message, project)
    elif message_type == "event":
        process_event(message, project)
    elif message_type == "user_report":
        process_userreport(message, project)
    else:
        raise ValueError(f"Unsupported message type: {message_type}")
