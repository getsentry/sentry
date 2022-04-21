from __future__ import annotations

import logging
from datetime import datetime
from typing import Dict, Sequence

import msgpack
from confluent_kafka import Message

from sentry import replaystore
from sentry.attachments import MissingAttachmentChunks, attachment_cache
from sentry.ingest.ingest_consumer import trace_func
from sentry.utils import metrics
from sentry.utils.batching_kafka_consumer import AbstractBatchWorker, BatchingKafkaConsumer
from sentry.utils.kafka import create_batching_kafka_consumer

CACHE_TIMEOUT = 3600
logger = logging.getLogger("sentry.replays")


def get_replay_payloads_consumer(
    topic: str,
    **options: Dict[str, str],
) -> BatchingKafkaConsumer:
    return create_batching_kafka_consumer(
        {topic},
        worker=ReplaysPayloadConsumer(),
        **options,
    )


class ReplaysPayloadConsumer(AbstractBatchWorker):  # type: ignore
    def process_message(self, message: Message) -> Message:
        message = msgpack.unpackb(message.value(), use_list=False)
        return message

    def flush_batch(self, messages: Sequence[Message]) -> None:
        replay_payload_chunks: list[Message] = []
        replay_payload_finals: list[Message] = []
        for message in messages:
            message_type = message["type"]
            if message_type == "attachment_chunk":
                replay_payload_chunks.append(message)
            elif message_type == "replay_payload":
                replay_payload_finals.append(message)

        for payload_chunk in replay_payload_chunks:
            process_replay_chunk(payload_chunk)
        for replay_payload_final in replay_payload_finals:
            process_individual_replay_payload(replay_payload_final)

    def shutdown(self) -> None:
        pass


def process_individual_replay_payload(message: Message) -> None:
    attachment = message["attachment"]
    id = message["attachment"]["id"]
    project_id = message["project_id"]
    init_replay_id = message["event_id"]
    cache_id = replay_cache_id(id, project_id)
    replay_payload = attachment_cache.get_from_chunks(
        key=cache_id, type=attachment.pop("attachment_type"), **attachment
    )
    try:
        replay_data = replay_payload.data
    except MissingAttachmentChunks:
        logger.warning("missing replay attachment chunks!")
        return None
    replaystore.set_payload(init_replay_id, replay_data, datetime.now())
    replay_payload.delete()


@trace_func(name="ingest_consumer.process_replay_chunk")  # type:ignore
@metrics.wraps("ingest_consumer.process_replay_chunk")  # type:ignore
def process_replay_chunk(message: Message) -> None:
    payload = message["payload"]
    project_id = message["project_id"]
    id = message["id"]
    chunk_index = message["chunk_index"]
    cache_key = replay_cache_id(id, project_id)
    attachment_cache.set_chunk(
        key=cache_key, id=id, chunk_index=chunk_index, chunk_data=payload, timeout=CACHE_TIMEOUT
    )


def replay_cache_id(id: int, project_id: int) -> str:
    return f"{project_id}:{id}"
