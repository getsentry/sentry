from __future__ import annotations

import uuid
from datetime import datetime

import msgpack
import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.attachments import MissingAttachmentChunks, attachment_cache
from sentry.ingest.consumer.attachment_event import decode_and_process_chunks
from sentry.ingest.types import ConsumerType
from sentry.services.eventstore.processing import (
    event_processing_store,
    transaction_processing_store,
)
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.cache import cache_key_for_event

PROJECT_ID = 1
CHUNK_DATA = b"Hello World!"

PROCESSING_STORES = {
    "events": event_processing_store,
    "transactions": transaction_processing_store,
}


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
@pytest.mark.parametrize(
    ("reprocess_only_stuck_events", "stuck_in", "expect_stored"),
    [
        (False, None, True),
        (True, None, False),
        (True, "events", True),
        (True, "transactions", True),
    ],
    ids=["normal_mode", "recovery_not_stuck", "recovery_stuck_event", "recovery_stuck_transaction"],
)
def test_decode_and_process_chunks_restores_chunks_only_for_stuck_events(
    django_cache,
    reprocess_only_stuck_events: bool,
    stuck_in: str | None,
    expect_stored: bool,
) -> None:
    event_id = uuid.uuid4().hex
    if stuck_in is not None:
        PROCESSING_STORES[stuck_in].store({"event_id": event_id, "project": PROJECT_ID})

    result = decode_and_process_chunks(
        make_chunk_message(event_id),
        consumer_type=ConsumerType.Attachments,
        reprocess_only_stuck_events=reprocess_only_stuck_events,
    )

    # chunks are never forwarded to the second step
    assert result is None
    if expect_stored:
        assert load_chunk(event_id) == CHUNK_DATA
    else:
        with pytest.raises(MissingAttachmentChunks):
            load_chunk(event_id)
