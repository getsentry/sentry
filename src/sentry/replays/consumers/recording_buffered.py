"""Replay recording consumer implementation.

# Configuration

The consumer implementation offers three configuration parameters which control the size of the
buffer.  Those options are:

**max_buffer_message_count:**

This option limits the number of processed messages held in memory at a given time.

**max_buffer_size_in_bytes:**

This option limits the amount of recording-bytes held in memory at a given time.

**max_buffer_time_in_seconds:**

This option limits the amount of time a message will wait in the buffer before being committed. If
this value exceeds the Kafka commit interval then the Kafka offsets will not be committed until the
buffer has been flushed and fully committed.

# Errors

All deterministic errors must be handled otherwise the consumer will deadlock and progress will
be impossible. Unhandled errors will crash the process and force a restart from the last committed
offset.

An unhandled, intermittent error rate which exceeds one-per-second will deadlock any consumer
implementation which commits at one second intervals. To fix this case either the message
processing rate of the consumer must be slowed, the error must be handled, or the commit interval
must be decreased.

The cost of unwinding an error is determined by the throughput of the consumer implementation. If
consumer throughput is high an error will force the reprocessing of a larger number of messages
than if throughput is low. The number of messages being operated on in parallel is material only
insofar as it impacts the throughput of the consumer.
"""
from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Mapping, Optional, TypedDict

import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import Commit, Message, Partition
from sentry_kafka_schemas import get_codec
from sentry_kafka_schemas.schema_types.ingest_replay_recordings_v1 import ReplayRecording

from sentry.replays.lib.storage import RecordingSegmentStorageMeta, storage
from sentry.replays.usecases.ingest import (
    MissingRecordingSegmentHeaders,
    decompress,
    process_headers,
    track_initial_segment_event,
)
from sentry.replays.usecases.ingest.dom_index import (
    ReplayActionsEvent,
    emit_replay_actions,
    parse_replay_actions,
)
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)

RECORDINGS_CODEC = get_codec("ingest-replay-recordings")


class BufferCommitFailed(Exception):
    ...


class RecordingBufferedStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    """
    This consumer processes replay recordings, which are compressed payloads split up into
    chunks.
    """

    def __init__(
        self,
        max_buffer_message_count: int,
        max_buffer_size_in_bytes: int,
        max_buffer_time_in_seconds: int,
    ) -> None:
        self.max_buffer_message_count = max_buffer_message_count
        self.max_buffer_size_in_bytes = max_buffer_size_in_bytes
        self.max_buffer_time_in_seconds = max_buffer_time_in_seconds

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RecordingBufferStrategy(
            buffer=RecordingBuffer(
                self.max_buffer_message_count,
                self.max_buffer_size_in_bytes,
                self.max_buffer_time_in_seconds,
            ),
            next_step=CommitOffsets(commit),
        )


# Buffered Processing Strategy.


class RecordingBufferStrategy(ProcessingStrategy[KafkaPayload]):
    def __init__(self, buffer: RecordingBuffer, next_step: CommitOffsets):
        self.__buffer = buffer
        self.__next_step = next_step
        self.__closed = False
        self.__last_message: Optional[Message[KafkaPayload]] = None

    def submit(self, message: Message[KafkaPayload]) -> None:
        assert not self.__closed

        # High CPU section.
        with sentry_sdk.start_span(op="replays.consumer.recording.process_message"):
            process_message(self.__buffer, message)

        self.__last_message = message

        if self.__buffer.ready_to_commit:
            self.__buffer.commit()
            self.__next_step.submit(message)

    def poll(self) -> None:
        assert not self.__closed

        # There's never a reason to poll the next_step. We either commit when the batch
        # is ready or we force a commit prior to shutdown.
        self.__flush(force=False)

    def close(self) -> None:
        self.__closed = True

    def terminate(self) -> None:
        self.__closed = True
        self.__buffer.reset()
        self.__next_step.terminate()

    def join(self, timeout: float | None = None) -> None:
        deadline = time.time() + timeout if timeout is not None else None

        # Flush doesn't guarantee a commit of the Kafka offsets.
        self.__flush(force=True)

        # This guarantees the Kafka offsets we are committed.
        self.__next_step.close()
        self.__next_step.join(
            timeout=max(deadline - time.time(), 0) if deadline is not None else None
        )

    def __flush(self, force: bool) -> None:
        if force or self.__buffer.ready_to_commit:
            self.__buffer.commit()
            if self.__last_message is not None:
                self.__next_step.submit(self.__last_message)


# Buffer definition.


class UploadEvent(TypedDict):
    payload: bytes
    project_id: int
    replay_id: str
    retention_days: int
    segment_id: int


class InitialSegmentEvent(TypedDict):
    key_id: int | None
    org_id: int
    project_id: int
    received: int
    replay_id: str


class RecordingBuffer:
    def __init__(
        self,
        max_buffer_message_count: int,
        max_buffer_size_in_bytes: int,
        max_buffer_time_in_seconds: int,
    ) -> None:
        self.upload_events: list[UploadEvent] = []
        self.initial_segment_events: list[InitialSegmentEvent] = []
        self.replay_action_events: list[ReplayActionsEvent] = []

        self.max_buffer_message_count = max_buffer_message_count
        self.max_buffer_size_in_bytes = max_buffer_size_in_bytes
        self.max_buffer_time_in_seconds = max_buffer_time_in_seconds
        self.reset()

    @property
    def ready_to_commit(self) -> bool:
        """Return "True" if we're ready to commit the buffer."""
        return (
            self.has_exceeded_max_message_count
            or self.has_exceeded_buffer_byte_size
            or self.has_exceeded_last_buffer_commit_time
        )

    def commit(self) -> None:
        if len(self.upload_events) > 0:
            # High I/O section.
            with sentry_sdk.start_span(op="replays.consumer.recording.commit_buffer"):
                commit_uploads(self.upload_events)
                commit_initial_segments(self.initial_segment_events)
                commit_replay_actions(self.replay_action_events)

        # Reset the buffer after each call to commit.
        self.reset()

    def reset(self) -> None:
        self.upload_events = []
        self.initial_segment_events = []
        self.replay_action_events = []

        self._buffer_size_in_bytes: int = 0
        self._buffer_next_commit_time: int = self._new_buffer_next_commit_time()

    def _new_buffer_next_commit_time(self) -> int:
        """Return the next buffer commit time."""
        return int(time.time()) + self.max_buffer_time_in_seconds

    @property
    def has_exceeded_max_message_count(self) -> bool:
        """Return "True" if we have accumulated the configured number of messages."""
        return len(self.upload_events) >= self.max_buffer_message_count

    @property
    def has_exceeded_buffer_byte_size(self) -> bool:
        """Return "True" if we have accumulated the configured number of bytes."""
        return self._buffer_size_in_bytes >= self.max_buffer_size_in_bytes

    @property
    def has_exceeded_last_buffer_commit_time(self) -> bool:
        """Return "True" if we have waited to commit for the configured amount of time."""
        return time.time() >= self._buffer_next_commit_time


# Message processor.


def process_message(buffer: RecordingBuffer, message: Message[KafkaPayload]) -> None:
    with sentry_sdk.start_span(op="replays.consumer.recording.decode_kafka_message"):
        decoded_message: ReplayRecording = RECORDINGS_CODEC.decode(message.payload.value)

    try:
        headers, recording_data = process_headers(decoded_message["payload"])
    except MissingRecordingSegmentHeaders:
        logger.warning("missing header on %s", decoded_message["replay_id"])
        return None

    # Append an upload event to the state object for later processing.
    buffer.upload_events.append(
        {
            "payload": recording_data,
            "project_id": decoded_message["project_id"],
            "replay_id": decoded_message["replay_id"],
            "retention_days": decoded_message["retention_days"],
            "segment_id": headers["segment_id"],
        }
    )

    # Initial segment events are recorded in the state machine.
    if headers["segment_id"] == 0:
        buffer.initial_segment_events.append(
            {
                "key_id": decoded_message["key_id"],
                "org_id": decoded_message["org_id"],
                "project_id": decoded_message["project_id"],
                "received": decoded_message["received"],
                "replay_id": decoded_message["replay_id"],
            }
        )

    with sentry_sdk.start_span(op="replays.consumer.recording.decompress_segment"):
        decompressed_segment = decompress(recording_data)

    with sentry_sdk.start_span(op="replays.consumer.recording.json_loads_segment"):
        parsed_recording_data = json.loads(decompressed_segment, use_rapid_json=True)

    replay_actions = parse_replay_actions(
        decoded_message["project_id"],
        decoded_message["replay_id"],
        decoded_message["retention_days"],
        parsed_recording_data,
    )

    if replay_actions is not None:
        buffer.replay_action_events.append(replay_actions)

    # Useful for computing the average cost of a replay.
    metrics.distribution(
        "replays.usecases.ingest.size_compressed",
        len(recording_data),
        unit="byte",
    )

    # Useful for computing the compression ratio.
    metrics.distribution(
        "replays.usecases.ingest.size_uncompressed",
        len(decompressed_segment),
        unit="byte",
    )


# Buffer commit.


def commit_uploads(upload_events: list[UploadEvent]) -> None:
    with sentry_sdk.start_span(op="replays.consumer.recording.upload_segments"):
        # This will run to completion taking potentially an infinite amount of time. However,
        # that outcome is unlikely. In the event of an indefinite backlog the process can be
        # restarted.
        with ThreadPoolExecutor(max_workers=len(upload_events)) as pool:
            futures = [pool.submit(_do_upload, upload) for upload in upload_events]

    has_errors = False

    # These futures should never fail unless there is a service-provider issue.
    for error in filter(lambda n: n is not None, (fut.exception() for fut in futures)):
        has_errors = True
        sentry_sdk.capture_exception(error)

    # If errors were detected the batch is failed as a whole. This wastes computation and
    # incurs some amount service-provider cost.  However, this strategy is an improvement
    # over dropping messages or manually retrying indefinitely.
    #
    # Raising an exception crashes the process and forces a restart from the last committed
    # offset. No rate-limiting is applied.
    if has_errors:
        raise BufferCommitFailed("Could not upload one or more recordings.")


def commit_initial_segments(initial_segment_events: list[InitialSegmentEvent]) -> None:
    for segment in initial_segment_events:
        track_initial_segment_event(
            segment["org_id"],
            segment["project_id"],
            segment["replay_id"],
            segment["key_id"],
            segment["received"],
        )


def commit_replay_actions(replay_action_events: list[ReplayActionsEvent]) -> None:
    for actions in replay_action_events:
        emit_replay_actions(actions)


def _do_upload(upload_event: UploadEvent) -> None:
    with sentry_sdk.start_span(op="replays.consumer.recording.upload_segment"):
        recording_metadata = RecordingSegmentStorageMeta(
            project_id=upload_event["project_id"],
            replay_id=upload_event["replay_id"],
            segment_id=upload_event["segment_id"],
            retention_days=upload_event["retention_days"],
        )
        recording_data = upload_event["payload"]

        # If an error occurs this will retry up to five times by default.
        #
        # Refer to `src.sentry.filestore.gcs.GCS_RETRIES`.
        storage.set(recording_metadata, recording_data)
