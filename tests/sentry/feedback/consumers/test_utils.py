import time
import uuid
from datetime import datetime
from typing import Any

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition

from sentry.event_manager import EventManager
from sentry.utils import json


def make_ingest_message(
    event: dict[str, Any] | bytes | str, project, normalize=False
) -> tuple[dict[str, Any], str]:
    # helper used to wrap an event in an IngestMessage (produced by Relay), with a random event_id
    # if `event` is a dict, reuse its event_id if it has one

    event_id = uuid.uuid4().hex
    if isinstance(event, dict):
        if nested_id := event.get("event_id"):
            assert isinstance(nested_id, str) and len(nested_id) == 32
            event_id = nested_id
        if normalize:
            em = EventManager(event, project=project)
            em.normalize()
            event = dict(em.get_data())
        payload = json.dumps(event)
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
