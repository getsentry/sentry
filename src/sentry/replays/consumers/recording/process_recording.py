from __future__ import annotations

import concurrent.futures
import logging
import random
import time
from collections import deque
from concurrent.futures import Future
from datetime import datetime, timezone
from io import BytesIO
from typing import Callable, Deque, Mapping, MutableMapping, NamedTuple, Optional, cast

import msgpack
import sentry_sdk
from arroyo import Partition
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.types import Message, Position
from django.conf import settings
from django.db.utils import IntegrityError

from sentry.constants import DataCategory
from sentry.models import File
from sentry.models.project import Project
from sentry.replays.cache import RecordingSegmentPart, RecordingSegmentParts
from sentry.replays.consumers.recording.types import (
    RecordingSegmentChunkMessage,
    RecordingSegmentHeaders,
    RecordingSegmentMessage,
)
from sentry.replays.models import ReplayRecordingSegment
from sentry.signals import first_replay_received
from sentry.utils import json, metrics
from sentry.utils.outcomes import Outcome, track_outcome

logger = logging.getLogger("sentry.replays")

CACHE_TIMEOUT = 3600
COMMIT_FREQUENCY_SEC = 1


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


class ProcessRecordingSegmentStrategy(ProcessingStrategy[KafkaPayload]):
    def __init__(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
    ) -> None:
        self.__closed = False
        self.__futures: Deque[ReplayRecordingMessageFuture] = deque()
        self.__threadpool = concurrent.futures.ThreadPoolExecutor()
        self.__commit = commit
        self.__commit_data: MutableMapping[Partition, Position] = {}
        self.__last_committed: float = 0

    @metrics.wraps("replays.process_recording.process_chunk")
    def _process_chunk(
        self, message_dict: RecordingSegmentChunkMessage, message: Message[KafkaPayload]
    ) -> None:
        cache_prefix = replay_recording_segment_cache_id(
            project_id=message_dict["project_id"],
            replay_id=message_dict["replay_id"],
            segment_id=message_dict["id"],
        )

        part = RecordingSegmentPart(cache_prefix)
        part[message_dict["chunk_index"]] = message_dict["payload"]

    def _process_headers(
        self, recording_segment_with_headers: bytes
    ) -> tuple[RecordingSegmentHeaders, bytes]:
        # split the recording payload by a newline into the headers and the recording
        try:
            recording_headers, recording_segment = recording_segment_with_headers.split(b"\n", 1)
        except ValueError:
            raise MissingRecordingSegmentHeaders
        return json.loads(recording_headers), recording_segment

    @metrics.wraps("replays.process_recording.store_recording")
    def _store(
        self,
        message_dict: RecordingSegmentMessage,
        parts: RecordingSegmentParts,
    ) -> None:
        with sentry_sdk.start_transaction(
            op="replays.consumer", name="replays.consumer.flush_batch"
        ):
            try:
                recording_segment_parts = list(parts)
            except ValueError:
                logger.exception("Missing recording-segment.")
                return None

            try:
                headers, parsed_first_part = self._process_headers(recording_segment_parts[0])
            except MissingRecordingSegmentHeaders:
                logger.warning(f"missing header on {message_dict['replay_id']}")
                return

            # Replace the first part with itself but the headers removed.
            recording_segment_parts[0] = parsed_first_part

            # The parts were gzipped by the SDK and disassembled by Relay. In this step we can
            # blindly merge the bytes objects into a single bytes object.
            recording_segment = b"".join(recording_segment_parts)

            count_existing_segments = ReplayRecordingSegment.objects.filter(
                replay_id=message_dict["replay_id"],
                project_id=message_dict["project_id"],
                segment_id=headers["segment_id"],
            ).count()

            if count_existing_segments > 0:
                with sentry_sdk.push_scope() as scope:
                    scope.level = "warning"
                    scope.add_attachment(bytes=recording_segment, filename="dup_replay_segment")
                    scope.set_tag("replay_id", message_dict["replay_id"])
                    scope.set_tag("project_id", message_dict["project_id"])

                    logging.exception("Recording segment was already processed.")

                parts.drop()

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

            try:
                # associate this file with an indexable replay_id via ReplayRecordingSegment
                ReplayRecordingSegment.objects.create(
                    replay_id=message_dict["replay_id"],
                    project_id=message_dict["project_id"],
                    segment_id=headers["segment_id"],
                    file_id=file.id,
                )
            except IntegrityError:
                # Same message was encountered more than once.
                logger.warning(
                    "Recording-segment has already been processed.",
                    extra={
                        "replay_id": message_dict["replay_id"],
                        "project_id": message_dict["project_id"],
                        "segment_id": headers["segment_id"],
                    },
                )

                # Cleanup the blob.
                file.delete()

            # delete the recording segment from cache after we've stored it
            parts.drop()

            # TODO: how to handle failures in the above calls. what should happen?
            # also: handling same message twice?

            # TODO: in join wait for outcomes producer to flush possibly,
            # or do this in a separate arroyo step
            # also need to talk with other teams on only-once produce requirements
            if headers["segment_id"] == 0 and message_dict.get("org_id"):
                project = Project.objects.get_from_cache(id=message_dict["project_id"])
                if not project.flags.has_replays:
                    first_replay_received.send_robust(project=project, sender=Project)

                track_outcome(
                    org_id=message_dict["org_id"],
                    project_id=message_dict["project_id"],
                    key_id=message_dict.get("key_id"),
                    outcome=Outcome.ACCEPTED,
                    reason=None,
                    timestamp=datetime.utcfromtimestamp(message_dict["received"]).replace(
                        tzinfo=timezone.utc
                    ),
                    event_id=message_dict["replay_id"],
                    category=DataCategory.REPLAY,
                    quantity=1,
                )

    def _process_recording(
        self, message_dict: RecordingSegmentMessage, message: Message[KafkaPayload]
    ) -> None:
        cache_prefix = replay_recording_segment_cache_id(
            project_id=message_dict["project_id"],
            replay_id=message_dict["replay_id"],
            segment_id=message_dict["replay_recording"]["id"],
        )
        parts = RecordingSegmentParts(
            prefix=cache_prefix, num_parts=message_dict["replay_recording"]["chunks"]
        )

        # in a thread, upload the recording segment and delete the cached version
        self.__futures.append(
            ReplayRecordingMessageFuture(
                message,
                self.__threadpool.submit(
                    self._store,
                    message_dict=message_dict,
                    parts=parts,
                ),
            )
        )

    @metrics.wraps("replays.process_recording.submit")
    def submit(self, message: Message[KafkaPayload]) -> None:
        assert not self.__closed

        try:
            with sentry_sdk.start_transaction(
                name="replays.consumer.process_recording",
                op="replays.consumer",
                sampled=random.random()
                < getattr(settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0),
            ):
                message_dict = msgpack.unpackb(message.payload.value)

                if message_dict["type"] == "replay_recording_chunk":
                    with sentry_sdk.start_span(op="replay_recording_chunk"):
                        self._process_chunk(
                            cast(RecordingSegmentChunkMessage, message_dict), message
                        )
                if message_dict["type"] == "replay_recording":
                    with sentry_sdk.start_span(op="replay_recording"):
                        self._process_recording(
                            cast(RecordingSegmentMessage, message_dict), message
                        )
        except Exception:
            # avoid crash looping on bad messsages for now
            logger.exception(
                "Failed to process replay recording message", extra={"offset": message.offset}
            )

    def close(self) -> None:
        self.__closed = True

    def terminate(self) -> None:
        self.close()
        self.__threadpool.shutdown(wait=False)

    def join(self, timeout: Optional[float] = None) -> None:
        start = time.time()

        # Immediately commit all the offsets we have popped from the queue.
        self.__throttled_commit(force=True)

        # Any remaining items in the queue are flushed until the process is terminated.
        while self.__futures:
            remaining = timeout - (time.time() - start) if timeout is not None else None
            if remaining is not None and remaining <= 0:
                logger.warning(f"Timed out with {len(self.__futures)} futures in queue")
                break

            # Pop the future from the queue.  If it succeeds great but if not it will be discarded
            # on the next loop iteration without commit.  An error will be logged.
            message, future = self.__futures.popleft()

            try:
                future.result(remaining)
                self.__commit({message.partition: Position(message.offset, message.timestamp)})
            except Exception:
                logger.exception(
                    "Async future failed in replays recording-segment consumer.",
                    extra={"offset": message.offset},
                )

    def poll(self) -> None:
        while self.__futures:
            message, future = self.__futures[0]
            if not future.done():
                break

            if future.exception():
                logger.error(
                    "Async future failed in replays recording-segment consumer.",
                    exc_info=future.exception(),
                    extra={"offset": message.offset},
                )

            self.__futures.popleft()
            self.__commit_data[message.partition] = Position(message.next_offset, message.timestamp)

        self.__throttled_commit()

    def __throttled_commit(self, force: bool = False) -> None:
        now = time.time()

        if (now - self.__last_committed) >= COMMIT_FREQUENCY_SEC or force is True:
            if self.__commit_data:
                self.__commit(self.__commit_data)
                self.__last_committed = now
                self.__commit_data = {}


def replay_recording_segment_cache_id(project_id: int, replay_id: str, segment_id: str) -> str:
    return f"{project_id}:{replay_id}:{segment_id}"
