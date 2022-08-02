from __future__ import annotations

import concurrent.futures
import logging
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
from sentry.attachments.base import CachedAttachment
from sentry.models import File
from sentry.replays.consumers.recording.types import (
    RecordingSegmentChunkMessage,
    RecordingSegmentHeaders,
    RecordingSegmentMessage,
)
from sentry.replays.models import ReplayRecordingSegment
from sentry.utils import json

logger = logging.getLogger("sentry.replays")

CACHE_TIMEOUT = 3600


class MissingRecordingSegmentHeaders(ValueError):
    pass


class ReplayRecordingMessageFuture(NamedTuple):
    """
    Map a submitted message to a Future returned by the Producer.
    This is useful for being able to commit the latest offset back
    to the original consumer.
    """

    message: Message[KafkaPayload]
    future: Future[None]


class ProcessRecordingSegmentStrategy(ProcessingStrategy[KafkaPayload]):  # type: ignore
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
        self, message_dict: RecordingSegmentChunkMessage, message: Message[KafkaPayload]
    ) -> None:
        # TODO: implement threaded chunk sets, and wait for an individual segment's
        # futures to finish before trying to read from redis in the final kafka message
        # https://github.com/getsentry/replay-backend/pull/38/files
        recording_segment_uuid = message_dict["id"]
        replay_id = message_dict["replay_id"]
        project_id = message_dict["project_id"]
        chunk_index = message_dict["chunk_index"]
        cache_key = replay_recording_segment_cache_id(project_id, replay_id)

        attachment_cache.set_chunk(
            key=cache_key,
            id=recording_segment_uuid,
            chunk_index=chunk_index,
            chunk_data=message_dict["payload"],
            timeout=CACHE_TIMEOUT,
        )

    def _process_headers(
        self, recording_segment_with_headers: bytes
    ) -> tuple[RecordingSegmentHeaders, bytes]:
        # split the recording payload by a newline into the headers and the recording
        try:
            recording_headers, recording_segment = recording_segment_with_headers.split(b"\n", 1)
        except ValueError:
            raise MissingRecordingSegmentHeaders
        return json.loads(recording_headers), recording_segment

    def _store(
        self,
        message_dict: RecordingSegmentMessage,
        cached_replay_recording_segment: CachedAttachment,
    ) -> None:
        try:
            headers, recording_segment = self._process_headers(cached_replay_recording_segment.data)
        except MissingRecordingSegmentHeaders:
            logger.warning(f"missing header on {message_dict['replay_id']}")
            return

        # create a File for our recording segment.
        recording_segment_file_name = f"rr:{message_dict['replay_id']}:{headers['segment_id']}"
        file = File.objects.create(
            name=recording_segment_file_name,
            type="replay.recording",
        )
        file.putfile(
            BytesIO(recording_segment),
            blob_size=settings.SENTRY_ATTACHMENT_BLOB_SIZE,
        )
        # associate this file with an indexable replay_id via ReplayRecordingSegment
        ReplayRecordingSegment.objects.create(
            replay_id=message_dict["replay_id"],
            project_id=message_dict["project_id"],
            segment_id=headers["segment_id"],
            file_id=file.id,
        )
        # delete the recording segment from cache after we've stored it
        cached_replay_recording_segment.delete()

        # TODO: how to handle failures in the above calls. what should happen?
        # also: handling same message twice?

    def _get_from_cache(self, message_dict: RecordingSegmentMessage) -> CachedAttachment | None:
        cache_id = replay_recording_segment_cache_id(
            message_dict["project_id"], message_dict["replay_id"]
        )
        cached_replay_recording = attachment_cache.get_from_chunks(
            key=cache_id, **message_dict["replay_recording"]
        )
        try:
            # try accessing data to ensure that it exists, which loads it
            cached_replay_recording.data
        except MissingAttachmentChunks:
            logger.warning("missing replay recording chunks!")
            return None
        return cached_replay_recording

    def _process_recording(
        self, message_dict: RecordingSegmentMessage, message: Message[KafkaPayload]
    ) -> None:
        cached_replay_recording = self._get_from_cache(message_dict)
        if cached_replay_recording is None:
            return

        # in a thread, upload the recording segment and delete the cached version
        self.__futures.append(
            ReplayRecordingMessageFuture(
                message,
                self.__threadpool.submit(
                    self._store,
                    message_dict=message_dict,
                    cached_replay_recording_segment=cached_replay_recording,
                ),
            )
        )

    def submit(self, message: Message[KafkaPayload]) -> None:
        assert not self.__closed

        # TODO: validate schema against json schema?
        try:
            message_dict = msgpack.unpackb(message.payload.value)

            if message_dict["type"] == "replay_recording_chunk":
                self._process_chunk(cast(RecordingSegmentChunkMessage, message_dict), message)
            if message_dict["type"] == "replay_recording":
                self._process_recording(cast(RecordingSegmentMessage, message_dict), message)
        except Exception as e:
            # avoid crash looping on bad messsages for now
            logger.exception("Failed to process message")
            sentry_sdk.capture_exception(e)

    def join(self, timeout: Optional[float] = None) -> None:
        wait([f for _, f in self.__futures], timeout=timeout, return_when=ALL_COMPLETED)
        self._commit_and_prune_futures()

    def close(self) -> None:
        self.__closed = True

    def _commit_and_prune_futures(self) -> None:
        """
        Commit the latest offset of any completed message from the original
        consumer.
        """

        committable: MutableMapping[Partition, Message[KafkaPayload]] = {}

        while self.__futures and self.__futures[0].future.done():
            message, _ = self.__futures.popleft()
            # overwrite any existing message as we assume the deque is in order
            # committing offset x means all offsets up to and including x are processed
            committable[message.partition] = message

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
        self.__threadpool.shutdown(wait=False)


def replay_recording_segment_cache_id(project_id: int, replay_id: str) -> str:
    return f"{project_id}:{replay_id}"
