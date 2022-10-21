from __future__ import annotations

import logging
import random
import time
from typing import Callable, Mapping, MutableMapping, Optional, cast

import msgpack
import sentry_sdk
from arroyo import Partition
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.types import Message, Position
from django.conf import settings

from sentry.replays.consumers.recording.types import (
    RecordingSegmentChunkMessage,
    RecordingSegmentMessage,
)
from sentry.replays.tasks import ingest_recording_segment
from sentry.replays.usecases.ingest import ingest_recording_segment_chunk
from sentry.utils import json, metrics
from sentry.utils.sdk import configure_scope

COMMIT_FREQUENCY_SEC = 1

logger = logging.getLogger("sentry.replays")


class ProcessRecordingSegmentStrategy(ProcessingStrategy[KafkaPayload]):
    def __init__(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
    ) -> None:
        self.__closed = False
        self.__commit = commit
        self.__commit_data: MutableMapping[Partition, Position] = {}
        self.__last_committed: float = 0

    def submit(self, message: Message[KafkaPayload]) -> None:
        assert not self.__closed
        process_message(message)
        self.__commit_data[message.partition] = Position(message.next_offset, message.timestamp)

    def close(self) -> None:
        self.__closed = True

    def terminate(self) -> None:
        self.close()

    def join(self, _: Optional[float] = None) -> None:
        self.__throttled_commit(force=True)

    def poll(self) -> None:
        self.__throttled_commit()

    def __throttled_commit(self, force: bool = False) -> None:
        now = time.time()

        if (now - self.__last_committed) >= COMMIT_FREQUENCY_SEC or force is True:
            if self.__commit_data:
                self.__commit(self.__commit_data)
                self.__last_committed = now
                self.__commit_data = {}


def process_message(message: Message[KafkaPayload]) -> None:
    try:
        with sentry_sdk.start_transaction(
            name="replays.consumer.process_recording",
            op="replays.consumer",
            sampled=random.random()
            < getattr(settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0),
        ):
            message_dict = msgpack.unpackb(message.payload.value)

            with configure_scope() as scope:
                # TODO: add replay sdk version once added
                scope.set_tag("replay_id", message_dict["replay_id"])
                scope.set_tag("project_id", message_dict["project_id"])

            if message_dict["type"] == "replay_recording_chunk":
                process_chunk(cast(RecordingSegmentChunkMessage, message_dict))
            elif message_dict["type"] == "replay_recording":
                process_recording(cast(RecordingSegmentMessage, message_dict))
    except Exception:
        # avoid crash looping on bad messsages for now
        logger.exception(
            "Failed to process replay recording message", extra={"offset": message.offset}
        )


@metrics.wraps("replays.consumer.process_chunk")
def process_chunk(message_dict: RecordingSegmentChunkMessage) -> None:
    sentry_sdk.set_extra("replay_id", message_dict["replay_id"])
    with sentry_sdk.start_span(op="process_chunk"):
        ingest_recording_segment_chunk(message_dict)


@metrics.wraps("replays.consumer.process_recording")
def process_recording(message_dict: RecordingSegmentMessage) -> None:
    sentry_sdk.set_extra("replay_id", message_dict["replay_id"])
    with sentry_sdk.start_span(op="process_recording"):
        ingest_recording_segment.delay(msgpack.packb(json.dumps(message_dict)))
