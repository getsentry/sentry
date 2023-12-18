import logging

import msgpack
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.types import Message

from sentry.models.project import Project
from sentry.utils import metrics

from .processors import IngestMessage, process_event

logger = logging.getLogger(__name__)


def process_simple_event_message(raw_message: Message[KafkaPayload]) -> None:
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

    return process_event(message, project)
