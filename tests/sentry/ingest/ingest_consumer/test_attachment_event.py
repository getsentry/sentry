from __future__ import annotations

import uuid
from datetime import datetime

import msgpack
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic
from django.core.cache.backends.base import BaseCache

from sentry.attachments import attachment_cache
from sentry.ingest.consumer.attachment_event import decode_and_process_chunks
from sentry.ingest.types import ConsumerType
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.cache import cache_key_for_event

PROJECT_ID = 1
CHUNK_DATA = b"Hello World!"


def make_chunk_message(event_id: str) -> Message[KafkaPayload]:
    payload = msgpack.packb(
        {
            "type": "attachment_chunk",
            "payload": CHUNK_DATA,
            "event_id": event_id,
            "project_id": PROJECT_ID,
            "id": 0,
            "chunk_index": 0,
        }
    )
    return Message(
        BrokerValue(
            KafkaPayload(None, payload, []),
            Partition(Topic("ingest-attachments"), 0),
            0,
            datetime.now(),
        )
    )


def load_chunk(event_id: str) -> bytes:
    key = cache_key_for_event({"event_id": event_id, "project": PROJECT_ID})
    return attachment_cache.get_from_chunks(key=key, id=0, chunks=1).load_data()


@django_db_all
def test_decode_and_process_chunks_stores_chunks(django_cache: BaseCache) -> None:
    event_id = uuid.uuid4().hex

    result = decode_and_process_chunks(
        make_chunk_message(event_id), consumer_type=ConsumerType.Attachments
    )

    # chunks are never forwarded to the second step
    assert result is None
    assert load_chunk(event_id) == CHUNK_DATA
