from sentry.replays.consumers.buffered.lib import Model, buffering_runtime

# RunTime implementation.


def init(flags: dict[str, str]) -> Model["Item"]:
    buffer = Buffer(flags)
    return Model(buffer=[], can_flush=buffer.can_flush, do_flush=buffer.do_flush, offsets={})


def process_message(message: bytes) -> "Item" | None:
    return _process_message(message)


recording_consumer = buffering_runtime(
    init_fn=init,
    process_fn=process_message,
)


# Business-logic implementation.
import dataclasses
import logging
import time
import uuid
import zlib
from typing import cast

import sentry_sdk
from django.conf import settings
from sentry_kafka_schemas.codecs import Codec, ValidationError
from sentry_kafka_schemas.schema_types.ingest_replay_recordings_v1 import ReplayRecording

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.replays.lib.storage import (
    RecordingSegmentStorageMeta,
    make_recording_filename,
    make_video_filename,
    storage_kv,
)
from sentry.replays.usecases.ingest import (
    RecordingIngestMessage,
    _report_size_metrics,
    process_headers,
    recording_post_processor,
    track_initial_segment_event,
)
from sentry.replays.usecases.ingest.dom_index import ReplayActionsEvent, _initialize_publisher
from sentry.utils import json

logger = logging.getLogger(__name__)

RECORDINGS_CODEC: Codec[ReplayRecording] = get_topic_codec(Topic.INGEST_REPLAYS_RECORDINGS)


@dataclasses.dataclass(frozen=True)
class EventMetadata:
    is_replay_video: bool
    key_id: int | None
    org_id: int
    project_id: int
    received: int
    replay_id: str
    retention_days: int
    segment_id: int


@dataclasses.dataclass(frozen=True)
class Item:
    action_events: list[ReplayActionsEvent]
    key_name: str
    metadata: EventMetadata
    recording: bytes
    video: bytes | None


@dataclasses.dataclass(frozen=True)
class FilePartRow:
    key: str
    range_start: int
    range_stop: int


@dataclasses.dataclass(frozen=True)
class MergedBuffer:
    action_events: list[ReplayActionsEvent]
    billed_events: list[EventMetadata]
    buffer: bytes
    buffer_rows: list[FilePartRow]
    remote_key: str


class Buffer:

    def __init__(self, flags: dict[str, str]) -> None:
        self.max_buffer_length = int(flags["max_buffer_length"])
        self.max_buffer_wait = int(flags["max_buffer_wait"])
        self.__last_flushed_at = time.time()

    def can_flush(self) -> bool:
        return (time.time() - self.max_buffer_wait) >= self.__last_flushed_at

    def do_flush(self, model: Model[Item]) -> None:
        merged_buffer = _merge_buffer(model.buffer)
        _commit_merged_buffer(merged_buffer)
        self.__last_flushed_at = time.time()


def _merge_buffer(buffer: list[Item]) -> MergedBuffer:
    action_events = []
    billed_events: list[EventMetadata] = []
    parts = b""
    parts_rows = []
    remote_key = uuid.uuid4().hex

    for item in buffer:
        # Extend the action events with whatever exists on the buffer item.
        action_events.extend(item.action_events)

        # Segment 0 events which are not replay-video are billed.
        if item.metadata.segment_id == 0 and not item.metadata.is_replay_video:
            billed_events.append(item.metadata)

        # Append the recording and video if applicable to the zipped file.
        meta = RecordingSegmentStorageMeta(
            project_id=item.metadata.project_id,
            replay_id=item.metadata.replay_id,
            segment_id=item.metadata.segment_id,
            retention_days=item.metadata.retention_days,
        )

        parts, part_row = _append_part(parts, item.recording, key=make_recording_filename(meta))
        parts_rows.append(part_row)

        if item.video:
            parts, part_row = _append_part(parts, item.video, key=make_video_filename(meta))
            parts_rows.append(part_row)

    return MergedBuffer(
        action_events=action_events,
        billed_events=billed_events,
        buffer=parts,
        buffer_rows=parts_rows,
        remote_key=remote_key,
    )


def _append_part(parts: bytes, part: bytes, key: str) -> tuple[bytes, FilePartRow]:
    range_start = len(parts)
    range_stop = range_start + len(part) - 1
    return (parts + part, FilePartRow(key, range_start, range_stop))


def _commit_merged_buffer(buffer: MergedBuffer) -> None:
    # Empty buffer's are not committed.
    if buffer.buffer == b"":
        return None

    # Upload recording.
    storage_kv.set(buffer.remote_key, buffer.buffer)

    # Write rows.
    # TODO: bulk insert rows

    # Emit billing.
    for event in buffer.billed_events:
        track_initial_segment_event(
            event.org_id,
            event.project_id,
            event.replay_id,
            event.key_id,
            event.received,
            event.is_replay_video,
        )

    # The action events need to be emitted to Snuba. We do it asynchronously so its fast. The
    # Kafka publisher is asynchronous. We need to flush to make sure the data is fully committed
    # before we can consider this buffer fully flushed and commit our local offsets.
    publisher = _initialize_publisher(asynchronous=True)
    for event in buffer.action_events:
        publisher.publish("ingest-replay-events", json.dumps(event))
    publisher.flush()

    return None


def _process_message(message: bytes) -> Item | None:
    transaction = sentry_sdk.start_transaction(
        name="replays.consumer.process_recording",
        op="replays.consumer",
        custom_sampling_context={
            "sample_rate": getattr(settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0)
        },
    )

    with transaction.start_child(
        op="replays.consumers.buffered.process_message", name="ingest_recording"
    ):
        # set_tag("org_id", message.org_id)
        # set_tag("project_id", message.project_id)

        try:
            message_dict: ReplayRecording = RECORDINGS_CODEC.decode(message.payload.value)
        except ValidationError:
            logger.exception("Could not decode recording message.")
            return None

        message = RecordingIngestMessage(
            replay_id=message_dict["replay_id"],
            key_id=message_dict.get("key_id"),
            org_id=message_dict["org_id"],
            project_id=message_dict["project_id"],
            received=message_dict["received"],
            retention_days=message_dict["retention_days"],
            payload_with_headers=cast(bytes, message_dict["payload"]),
            replay_event=cast(bytes | None, message_dict.get("replay_event")),
            replay_video=cast(bytes | None, message_dict.get("replay_video")),
        )

        try:
            headers, compressed_segment = process_headers(message.payload_with_headers)
        except Exception:
            logger.exception("Recording headers could not be extracted %s", message.replay_id)
            return None

        # Segment is decompressed for further analysis. Packed format expects
        # concatenated, uncompressed bytes.
        try:
            recording_segment = zlib.decompress(compressed_segment)
            _report_size_metrics(len(compressed_segment), len(recording_segment))
        except zlib.error:
            if compressed_segment[0] == ord("["):
                recording_segment = compressed_segment
                compressed_segment = zlib.compress(compressed_segment)  # Save storage $$$
            else:
                logger.exception("Invalid recording body.")
                return None

        recording_post_processor(
            message, headers, recording_segment, message.replay_event, transaction
        )


@sentry_sdk.trace
def _decode_recording_message(message: bytes) -> RecordingIngestMessage | None:
    try:
        message_dict: ReplayRecording = RECORDINGS_CODEC.decode(message)
    except ValidationError:
        logger.exception("Could not decode recording message.")
        return None

    return RecordingIngestMessage(
        replay_id=message_dict["replay_id"],
        key_id=message_dict.get("key_id"),
        org_id=message_dict["org_id"],
        project_id=message_dict["project_id"],
        received=message_dict["received"],
        retention_days=message_dict["retention_days"],
        payload_with_headers=cast(bytes, message_dict["payload"]),
        replay_event=cast(bytes | None, message_dict.get("replay_event")),
        replay_video=cast(bytes | None, message_dict.get("replay_video")),
    )
