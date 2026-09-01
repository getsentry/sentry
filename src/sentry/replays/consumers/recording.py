import logging
import zlib
from typing import NoReturn, cast

import sentry_sdk
from sentry_kafka_schemas.codecs import Codec, ValidationError
from sentry_kafka_schemas.schema_types.ingest_replay_recordings_v1 import ReplayRecording
from sentry_sdk import set_tag

from sentry import options
from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.replays.usecases.ingest import (
    DropEvent,
    Event,
    ProcessedEvent,
    commit_recording_message,
    process_recording_event,
    track_recording_metadata,
)
from sentry.replays.usecases.ingest.types import ProcessorContext
from sentry.services.filestore.gcs import GCS_RETRYABLE_ERRORS
from sentry.utils import json, metrics
from sentry.utils.tracing import trace

RECORDINGS_CODEC: Codec[ReplayRecording] = get_topic_codec(Topic.INGEST_REPLAYS_RECORDINGS)

logger = logging.getLogger(__name__)


class DropSilently(Exception):
    pass


# Processing Task


@trace
def process_message(message: bytes) -> ProcessedEvent | None:
    try:
        recording_event = parse_recording_event(
            message,
            max_segment_size=options.get("replay.consumer.max-segment-decompressed-size"),
        )
        set_tag("org_id", recording_event["context"]["org_id"])
        sentry_sdk.set_attribute("org_id", recording_event["context"]["org_id"])
        set_tag("project_id", recording_event["context"]["project_id"])
        sentry_sdk.set_attribute("project_id", recording_event["context"]["project_id"])
        return process_recording_event(
            recording_event,
            use_new_recording_parser=options.get("replay.consumer.msgspec_recording_parser"),
        )
    except DropSilently:
        return None
    except Exception:
        logger.exception("Failed to process replay recording message.")
        return None


@trace
def parse_recording_event(message: bytes, max_segment_size: int) -> Event:
    recording = parse_request_message(message)
    segment_id, payload = parse_headers(cast(bytes, recording["payload"]), recording["replay_id"])
    compressed, decompressed = decompress_segment(payload, max_segment_size)

    replay_event_json = recording.get("replay_event")
    if replay_event_json:
        replay_event = json.loads(cast(bytes, replay_event_json))
    else:
        # Check if any events are not present in the pipeline. We need
        # to know because we want to write to Snuba from here soon.
        metrics.incr("sentry.replays.consumer.recording.missing-replay-event")
        replay_event = None

    replay_video_raw = recording.get("replay_video")
    if replay_video_raw is not None:
        replay_video = cast(bytes, replay_video_raw)
    else:
        replay_video = None

    relay_snuba_publish_disabled = recording.get("relay_snuba_publish_disabled", False)

    # No matter what value we receive "True" is the only value that can influence our behavior.
    # Otherwise we default to "False" which means our consumer does nothing. Its only when Relay
    # reports that it has disabled itself that we publish to the Snuba consumer. Any other value
    # is invalid and means we should _not_ publish to Snuba.
    if relay_snuba_publish_disabled is not True:
        relay_snuba_publish_disabled = False

    return {
        "context": {
            "key_id": recording.get("key_id"),
            "org_id": recording["org_id"],
            "project_id": recording["project_id"],
            "received": recording["received"],
            "replay_id": recording["replay_id"],
            "retention_days": recording["retention_days"],
            "segment_id": segment_id,
            "should_publish_replay_event": relay_snuba_publish_disabled,
        },
        "payload_compressed": compressed,
        "payload": decompressed,
        "replay_event": replay_event,
        "replay_video": replay_video,
    }


@trace
def parse_request_message(message: bytes) -> ReplayRecording:
    try:
        return RECORDINGS_CODEC.decode(message)
    except ValidationError:
        logger.exception("Could not decode recording message.")
        raise DropSilently()


@trace
def decompress_segment(segment: bytes, max_size: int) -> tuple[bytes, bytes]:
    """Return the compressed and decompressed forms of a recording segment.

    Decompression is bounded to `max_size` bytes. Stored segments are inflated again on every
    read, so a segment with an implausible compression ratio is a durable, repeatable cost on
    the read path -- we drop it here rather than persist it.
    """
    try:
        # Ask for one byte past the limit so an oversized segment is detectable without ever
        # materializing more than `max_size + 1` bytes.
        decompressor = zlib.decompressobj()
        decompressed = decompressor.decompress(segment, max_size + 1)

        # The incremental API returns partial output where `zlib.decompress` raised on a
        # truncated stream. Normalize so malformed bodies take the branch below.
        if not decompressor.eof and not decompressor.unconsumed_tail:
            raise zlib.error("incomplete or truncated stream")
    except zlib.error:
        if segment and segment[0] == ord("["):
            if len(segment) > max_size:
                _drop_oversized_segment(len(segment), max_size)
            return (zlib.compress(segment), segment)
        else:
            logger.exception("Invalid recording body.")
            raise DropSilently()

    if len(decompressed) > max_size:
        _drop_oversized_segment(len(segment), max_size)

    return (segment, decompressed)


def _drop_oversized_segment(compressed_size: int, max_size: int) -> NoReturn:
    metrics.incr("replays.consumer.recording.oversized_segment")
    logger.warning(
        "Dropped a recording segment which decompressed past the size limit.",
        extra={"compressed_size": compressed_size, "max_size": max_size},
    )
    raise DropSilently()


@trace
def parse_headers(recording: bytes, replay_id: str) -> tuple[int, bytes]:
    try:
        recording_headers_json, recording_segment = recording.split(b"\n", 1)
        return int(json.loads(recording_headers_json)["segment_id"]), recording_segment
    except Exception:
        logger.exception("Recording headers could not be extracted %s", replay_id)
        raise DropSilently()


# I/O Task


@trace
def commit_message(message: ProcessedEvent, context: ProcessorContext) -> None:
    try:
        commit_recording_message(message, context)
        track_recording_metadata(message)
        return None
    except GCS_RETRYABLE_ERRORS:
        raise
    except DropEvent:
        return None
    except Exception:
        logger.exception("Failed to commit replay recording message.")
        return None
