from __future__ import annotations

import concurrent.futures
import logging
import time
from collections import deque
from concurrent.futures import ALL_COMPLETED, Future, wait
from io import BytesIO
from typing import Callable, Deque, Mapping, MutableMapping, NamedTuple, Optional, cast

import msgpack
import sentry_sdk
from arroyo import Partition
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.types import Message, Position
from django.conf import settings

from sentry.attachments import MissingAttachmentChunks, attachment_cache
from sentry.models import File
from sentry.replays.consumers.recording.types import RecordingChunkMessage, RecordingMessage
from sentry.replays.models import ReplayRecordingSegment
from sentry.utils import json

logger = logging.getLogger("sentry.replays")

CACHE_TIMEOUT = 3600


class ReplayRecordingMessageFuture(NamedTuple):
    """
    Map a submitted message to a Future returned by the Producer.
    This is useful for being able to commit the latest offset back
    to the original consumer.
    """

    message: Message[KafkaPayload]
    future: Future[bool | None]


class ProcessRecordingStrategy(ProcessingStrategy[KafkaPayload]):
    def __init__(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
    ) -> None:
        self.__closed = False
        self.__futures: Deque[ReplayRecordingMessageFuture] = deque()
        self.__threadpool = concurrent.futures.ThreadPoolExecutor()
        self.__commit = commit

    def poll(self) -> None:
        self._commit_and_prune_futures()

    def _process_chunk(
        self, message_dict: RecordingChunkMessage, message: Message[KafkaPayload]
    ) -> None:

        # can't make this a future as we need to guarentee this happens before
        # the final kafka message
        # TODO: determine if this is acceptable at scale
        id = message_dict["id"]
        project_id = message_dict["project_id"]
        chunk_index = message_dict["chunk_index"]
        cache_key = replay_cache_id(id, project_id)

        attachment_cache.set_chunk(
            key=cache_key,
            id=id,
            chunk_index=chunk_index,
            chunk_data=message_dict["payload"],
            timeout=CACHE_TIMEOUT,
        )

    def _store(self, message_dict: RecordingMessage, recording: bytes) -> None:
        # create a File for our recording segment.
        recording_file_name = (
            f"rr:{message_dict['replay_id']}:{message_dict['recording_headers']['sequence_id']}"
        )

        file = File.objects.create(
            name=recording_file_name,
            type="replay.recording",
        )
        file.putfile(
            BytesIO(recording),
            blob_size=settings.SENTRY_ATTACHMENT_BLOB_SIZE,
        )
        # associate this file with an indexable replay_id via ReplayRecordingSegment
        ReplayRecordingSegment.objects.create(
            replay_id=message_dict["replay_id"],
            project_id=message_dict["project_id"],
            sequence_id=message_dict["recording_headers"]["sequence_id"],
            file_id=file.id,
        )

    def _get_from_cache(self, message_dict):
        replay_recording = message_dict["replay_recording"]
        id = message_dict["replay_recording"]["id"]
        project_id = message_dict["project_id"]
        cache_id = replay_cache_id(id, project_id)
        replay_payload = attachment_cache.get_from_chunks(key=cache_id, **replay_recording)
        try:
            replay_data = replay_payload.data
        except MissingAttachmentChunks:
            logger.warning("missing replay recording chunks!")
            return None
        replay_payload.delete()
        return replay_data

    def _process_recording(
        self, message_dict: RecordingMessage, message: Message[KafkaPayload]
    ) -> None:
        recording = self._get_from_cache(message_dict)
        # split the recording payload by a newline into the headers and the recording
        try:
            recording_headers, recording = recording.split(b"\n", 1)
        except ValueError:
            logger.warning(f"no headers on recording {message_dict['replay_id']}, dropping")
            return
        message_dict["recording_headers"] = json.loads(recording_headers)

        # Upload the combined to the datastore.
        self.__futures.append(
            ReplayRecordingMessageFuture(
                message,
                self.__threadpool.submit(
                    self._store, message_dict=message_dict, recording=recording
                ),
            )
        )

    def submit(self, message: Message[KafkaPayload]) -> None:
        assert not self.__closed

        # TODO: validate schema against json schema?
        try:
            message_dict = msgpack.unpackb(message.payload.value)

            if message_dict["type"] == "replay_recording_chunk":
                self._process_chunk(cast(RecordingChunkMessage, message_dict), message)
            if message_dict["type"] == "replay_recording":
                self._process_recording(cast(RecordingMessage, message_dict), message)
        except Exception as e:
            # avoid crash looping on bad messsages for now
            sentry_sdk.capture_exception(e)
            logger.error(e)

    def join(self, timeout: Optional[float] = None) -> None:
        wait([f for m, f in self.__futures], timeout=timeout, return_when=ALL_COMPLETED)
        self._commit_and_prune_futures()

    def close(self) -> None:
        self.__closed = True

    def _commit_and_prune_futures(self, timeout: float | None = None) -> None:
        """
        Commit the latest offset of any completed message from the original
        consumer.
        """
        start = time.perf_counter()

        committable: MutableMapping[Partition, Message[KafkaPayload]] = {}

        while self.__futures and self.__futures[0].future.done():
            message, _ = self.__futures.popleft()
            # overwrite any existing message as we assume the deque is in order
            # committing offset x means all offsets up to and including x are processed
            committable[message.partition] = message

            if timeout is not None and time.perf_counter() - start > timeout:
                break

        # Commit the latest offset that has its corresponding produce finished, per partition

        if committable:
            # TODO: throttle commits,
            # https://github.com/getsentry/replay-backend/pull/2#discussion_r890653305
            self.__commit(
                {
                    partition: Position(message.next_offset, message.timestamp)
                    for partition, message in committable.items()
                }
            )

    def terminate(self) -> None:
        self.close()
        self.__threadpool.shutdown(wait=False, cancel_futures=True)


def replay_cache_id(id: int, project_id: int) -> str:
    return f"{project_id}:{id}"
