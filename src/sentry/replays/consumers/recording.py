from __future__ import annotations

import logging
import zlib
from collections.abc import Mapping
from typing import cast

import sentry_sdk
import sentry_sdk.scope
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import RunTask, RunTaskInThreads
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import Commit, FilteredPayload, Message, Partition
from django.conf import settings
from sentry_kafka_schemas.codecs import Codec, ValidationError
from sentry_kafka_schemas.schema_types.ingest_replay_recordings_v1 import ReplayRecording
from sentry_sdk import set_tag

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.filestore.gcs import GCS_RETRYABLE_ERRORS
from sentry.replays.usecases.ingest import (
    Event,
    ProcessedEvent,
    commit_recording_message,
    process_recording_event,
    track_recording_metadata,
)
from sentry.utils import json

RECORDINGS_CODEC: Codec[ReplayRecording] = get_topic_codec(Topic.INGEST_REPLAYS_RECORDINGS)

logger = logging.getLogger(__name__)


class DropSilently(Exception):
    pass


class ProcessReplayRecordingStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        input_block_size: int | None,
        max_batch_size: int,
        max_batch_time: int,
        num_processes: int,
        output_block_size: int | None,
        num_threads: int = 4,  # Defaults to 4 for self-hosted.
        force_synchronous: bool = False,  # Force synchronous runner (only used in test suite).
        max_pending_futures: int = 512,
    ) -> None:
        # For information on configuring this consumer refer to this page:
        #   https://getsentry.github.io/arroyo/strategies/run_task_with_multiprocessing.html
        self.input_block_size = input_block_size
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.num_processes = num_processes
        self.num_threads = num_threads
        self.output_block_size = output_block_size
        self.force_synchronous = force_synchronous
        self.max_pending_futures = max_pending_futures

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTask(
            function=process_message,
            next_step=RunTaskInThreads(
                processing_function=commit_message,
                concurrency=self.num_threads,
                max_pending_futures=self.max_pending_futures,
                next_step=CommitOffsets(commit),
            ),
        )


# Processing Task


def process_message(message: Message[KafkaPayload]) -> ProcessedEvent | FilteredPayload:
    with sentry_sdk.start_transaction(
        name="replays.consumer.recording_buffered.process_message",
        op="replays.consumer.recording_buffered.process_message",
        custom_sampling_context={
            "sample_rate": getattr(settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0)
        },
    ):
        try:
            recording_event = parse_recording_event(message.payload.value)
            set_tag("org_id", recording_event["context"]["org_id"])
            set_tag("project_id", recording_event["context"]["project_id"])
            return process_recording_event(recording_event)
        except DropSilently:
            return FilteredPayload()
        except Exception:
            logger.exception("Failed to process replay recording message.")
            return FilteredPayload()


@sentry_sdk.trace
def parse_recording_event(message: bytes) -> Event:
    recording = parse_request_message(message)
    segment_id, payload = parse_headers(cast(bytes, recording["payload"]), recording["replay_id"])
    compressed, decompressed = decompress_segment(payload)

    replay_event_json = recording.get("replay_event")
    if replay_event_json:
        replay_event = json.loads(cast(bytes, replay_event_json))
    else:
        replay_event = None

    replay_video_raw = recording.get("replay_video")
    if replay_video_raw is not None:
        replay_video = cast(bytes, replay_video_raw)
    else:
        replay_video = None

    return {
        "context": {
            "key_id": recording.get("key_id"),
            "org_id": recording["org_id"],
            "project_id": recording["project_id"],
            "received": recording["received"],
            "replay_id": recording["replay_id"],
            "retention_days": recording["retention_days"],
            "segment_id": segment_id,
        },
        "payload_compressed": compressed,
        "payload": decompressed,
        "replay_event": replay_event,
        "replay_video": replay_video,
    }


@sentry_sdk.trace
def parse_request_message(message: bytes) -> ReplayRecording:
    try:
        return RECORDINGS_CODEC.decode(message)
    except ValidationError:
        logger.exception("Could not decode recording message.")
        raise DropSilently()


@sentry_sdk.trace
def decompress_segment(segment: bytes) -> tuple[bytes, bytes]:
    try:
        return (segment, zlib.decompress(segment))
    except zlib.error:
        if segment and segment[0] == ord("["):
            return (zlib.compress(segment), segment)
        else:
            logger.exception("Invalid recording body.")
            raise DropSilently()


@sentry_sdk.trace
def parse_headers(recording: bytes, replay_id: str) -> tuple[int, bytes]:
    try:
        recording_headers_json, recording_segment = recording.split(b"\n", 1)
        return int(json.loads(recording_headers_json)["segment_id"]), recording_segment
    except Exception:
        logger.exception("Recording headers could not be extracted %s", replay_id)
        raise DropSilently()


# I/O Task


def commit_message(message: Message[ProcessedEvent]) -> None:
    isolation_scope = sentry_sdk.get_isolation_scope().fork()
    with sentry_sdk.scope.use_isolation_scope(isolation_scope):
        with sentry_sdk.start_transaction(
            name="replays.consumer.recording_buffered.commit_message",
            op="replays.consumer.recording_buffered.commit_message",
            custom_sampling_context={
                "sample_rate": getattr(
                    settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0
                )
            },
        ):
            try:
                commit_recording_message(message.payload)
                track_recording_metadata(message.payload)
                return None
            except GCS_RETRYABLE_ERRORS:
                raise
            except Exception:
                logger.exception("Failed to commit replay recording message.")
                return None
