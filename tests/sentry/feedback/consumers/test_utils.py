import time
import uuid
from datetime import datetime
from typing import Any

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition

from sentry.event_manager import EventManager
from sentry.ingest.consumer.processors import IngestMessage
from sentry.utils import json


def make_ingest_message(event: dict[str, Any] | bytes | str, project) -> tuple[IngestMessage, str]:
    # returns an IngestMessage (produced by Relay) and its event_id
    # the input `event` is wrapped into message["payload"]
    event_id = uuid.uuid4().hex
    if isinstance(event, dict):
        # if it is a dict, normalize it and reuse its event_id, if it has one
        if nested_id := event.get("event_id"):
            assert isinstance(nested_id, str) and len(nested_id) == 32
            event_id = nested_id
        em = EventManager(event, project=project)
        em.normalize()
        normalized_event = dict(em.get_data())
        payload = json.dumps(normalized_event)
    else:
        payload = event

    message = {
        "type": "event",
        "start_time": int(time.time()),
        "event_id": event_id,
        "project_id": int(project.id),
        "payload": payload,
    }
    return message, event_id


def make_broker_message(ingest_message: bytes, partition: Partition, offset: int) -> Message:
    return Message(
        BrokerValue(
            KafkaPayload(None, ingest_message, []),
            partition,
            offset,
            datetime.now(),
        )
    )
