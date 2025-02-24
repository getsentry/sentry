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
import zlib
from collections.abc import Mapping
from concurrent.futures import ThreadPoolExecutor
from typing import Any, TypedDict, cast

import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.buffer import Buffer
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BaseValue, Commit, Message, Partition
from sentry_kafka_schemas.codecs import Codec, ValidationError
from sentry_kafka_schemas.schema_types.ingest_replay_recordings_v1 import ReplayRecording

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.logging.handlers import SamplingFilter
from sentry.models.project import Project
from sentry.replays.lib.storage import (
    RecordingSegmentStorageMeta,
    make_recording_filename,
    storage_kv,
)
from sentry.replays.usecases.ingest import (
    LOG_SAMPLE_RATE,
    DropSilently,
    _report_size_metrics,
    decompress_segment,
    parse_headers,
    track_initial_segment_event,
)
from sentry.replays.usecases.ingest.dom_index import (
    ReplayActionsEvent,
    emit_replay_actions,
    parse_replay_actions,
)
from sentry.replays.usecases.pack import pack
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)
logger.addFilter(SamplingFilter(LOG_SAMPLE_RATE))

RECORDINGS_CODEC: Codec[ReplayRecording] = get_topic_codec(Topic.INGEST_REPLAYS_RECORDINGS)


def cast_payload_bytes(x: Any) -> bytes:
    """
    Coerces a type from Any to bytes

    sentry-kafka-schemas does not support the typing of bytes for replay's
    payloads, and so sometimes we have to cast values around to work around the
    schema.

    Use this helper function to explicitly annotate that. At a later point when
    sentry-kafka-schemas is fixed, we can replace all usages of this function
    with the proper solution.
    """
    return x


def cast_payload_from_bytes(x: bytes) -> Any:
    """
    Coerces a type from bytes to Any.

    See cast_payload_bytes
    """
    return x


class BufferCommitFailed(Exception):
    pass


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
        return Buffer(
            buffer=RecordingBuffer(
                self.max_buffer_message_count,
                self.max_buffer_size_in_bytes,
                self.max_buffer_time_in_seconds,
            ),
            next_step=RunTask(
                function=process_commit,
                next_step=CommitOffsets(commit),
            ),
        )


class UploadEvent(TypedDict):
    key: str
    value: bytes


class InitialSegmentEvent(TypedDict):
    key_id: int | None
    org_id: int
    project_id: int
    received: int
    replay_id: str
    is_replay_video: bool


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

        self._buffer_size_in_bytes: int = 0
        self._buffer_next_commit_time: int = int(time.time()) + self.max_buffer_time_in_seconds

    @property
    def buffer(
        self,
    ) -> tuple[list[UploadEvent], list[InitialSegmentEvent], list[ReplayActionsEvent]]:
        return (self.upload_events, self.initial_segment_events, self.replay_action_events)

    @property
    def is_empty(self) -> bool:
        return len(self.upload_events) == 0

    @property
    def is_ready(self) -> bool:
        """Return "True" if we're ready to commit the buffer."""
        return (
            self.has_exceeded_max_message_count
            or self.has_exceeded_buffer_byte_size
            or self.has_exceeded_last_buffer_commit_time
        )

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

    def append(self, message: BaseValue[KafkaPayload]) -> None:
        try:
            process_message(self, message.payload.value)
        except DropSilently:
            pass

    def new(self) -> RecordingBuffer:
        return RecordingBuffer(
            max_buffer_message_count=self.max_buffer_message_count,
            max_buffer_size_in_bytes=self.max_buffer_size_in_bytes,
            max_buffer_time_in_seconds=self.max_buffer_time_in_seconds,
        )


# Message processor.


def process_message(buffer: RecordingBuffer, message: bytes) -> None:
    with sentry_sdk.start_span(op="replays.consumer.recording.decode_kafka_message"):
        try:
            decoded_message: ReplayRecording = RECORDINGS_CODEC.decode(message)
        except ValidationError:
            # TODO: DLQ
            logger.exception("Could not decode recording message.")
            return None

    headers, segment_data = parse_headers(
        cast_payload_bytes(decoded_message["payload"]), decoded_message["replay_id"]
    )

    segment = decompress_segment(segment_data)
    compressed_segment, recording_data = segment.compressed, segment.decompressed
    _report_size_metrics(len(segment.compressed), len(segment.decompressed))

    recording_segment = RecordingSegmentStorageMeta(
        project_id=decoded_message["project_id"],
        replay_id=decoded_message["replay_id"],
        retention_days=decoded_message["retention_days"],
        segment_id=headers["segment_id"],
    )

    if replay_video := decoded_message.get("replay_video"):
        # Logging org info for bigquery
        logger.info(
            "sentry.replays.slow_click",
            extra={
                "event_type": "mobile_event",
                "org_id": decoded_message["org_id"],
                "project_id": decoded_message["project_id"],
                "size": len(replay_video),  # type: ignore[arg-type]
            },
        )

        # Record video size for COGS analysis.
        metrics.incr("replays.recording_consumer.replay_video_count")
        metrics.distribution(
            "replays.recording_consumer.replay_video_size",
            len(replay_video),  # type: ignore[arg-type]
            unit="byte",
        )

        dat = zlib.compress(pack(rrweb=recording_data, video=cast(bytes, replay_video)))
        buffer.upload_events.append(
            {"key": make_recording_filename(recording_segment), "value": dat}
        )

        # Track combined payload size.
        metrics.distribution(
            "replays.recording_consumer.replay_video_event_size", len(dat), unit="byte"
        )
    else:
        buffer.upload_events.append(
            {"key": make_recording_filename(recording_segment), "value": compressed_segment}
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
                "is_replay_video": decoded_message.get("replay_video") is not None,
            }
        )

    try:
        with sentry_sdk.start_span(op="replays.consumer.recording.json_loads_segment"):
            parsed_recording_data = json.loads(recording_data)
            parsed_replay_event = (
                json.loads(cast_payload_bytes(decoded_message["replay_event"]))
                if decoded_message.get("replay_event")
                else None
            )

        project = Project.objects.get_from_cache(id=decoded_message["project_id"])
        replay_actions = parse_replay_actions(
            project,
            decoded_message["replay_id"],
            decoded_message["retention_days"],
            parsed_recording_data,
            parsed_replay_event,
            org_id=decoded_message["org_id"],
        )

        if replay_actions is not None:
            buffer.replay_action_events.append(replay_actions)
    except Exception:
        logging.exception(
            "Failed to parse recording org=%s, project=%s, replay=%s, segment=%s",
            decoded_message["org_id"],
            decoded_message["project_id"],
            decoded_message["replay_id"],
            headers["segment_id"],
        )


# Commit.


def process_commit(
    message: Message[tuple[list[UploadEvent], list[InitialSegmentEvent], list[ReplayActionsEvent]]]
) -> None:
    # High I/O section.
    with sentry_sdk.start_span(op="replays.consumer.recording.commit_buffer"):
        upload_events, initial_segment_events, replay_action_events = message.payload
        commit_uploads(upload_events)
        commit_initial_segments(initial_segment_events)
        commit_replay_actions(replay_action_events)


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
            segment["is_replay_video"],
        )


def commit_replay_actions(replay_action_events: list[ReplayActionsEvent]) -> None:
    for actions in replay_action_events:
        emit_replay_actions(actions)


def _do_upload(upload_event: UploadEvent) -> None:
    with sentry_sdk.start_span(op="replays.consumer.recording.upload_segment"):
        # If an error occurs this will retry up to five times by default.
        #
        # Refer to `src.sentry.filestore.gcs.GCS_RETRIES`.
        storage_kv.set(upload_event["key"], upload_event["value"])
