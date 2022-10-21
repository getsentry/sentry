import logging
from io import BytesIO
from typing import Tuple, TypedDict

from django.conf import settings

from sentry.models import File
from sentry.replays.cache import RecordingSegmentPart, RecordingSegmentParts
from sentry.replays.models import ReplayRecordingSegment
from sentry.utils import json

logger = logging.getLogger("sentry.replays")


class MissingRecordingSegmentHeaders(ValueError):
    pass


class ReplayRecordingChunkSegment(TypedDict):
    id: str
    chunks: int


class RecordingSegmentMessage(TypedDict):
    replay_id: str
    project_id: int
    replay_recording: ReplayRecordingChunkSegment


class RecordingSegmentChunkMessage(TypedDict):
    id: str  # a uuid that individualy identifies a recording segment
    chunk_index: int  # each segment is split into chunks to fit into kafka
    payload: bytes
    replay_id: str  # the uuid of the encompassing replay event
    project_id: int


def ingest_recording_segment(message_dict: RecordingSegmentMessage) -> None:
    cache_prefix = _make_replay_recording_segment_cache_id(
        project_id=message_dict["project_id"],
        replay_id=message_dict["replay_id"],
        segment_id=message_dict["replay_recording"]["id"],
    )
    parts = RecordingSegmentParts(
        prefix=cache_prefix, num_parts=message_dict["replay_recording"]["chunks"]
    )

    try:
        recording_segment_parts = list(parts)
    except ValueError:
        logger.exception("Missing recording-segment.")
        return None

    try:
        headers, parsed_first_part = _process_headers(recording_segment_parts[0])
    except MissingRecordingSegmentHeaders:
        logger.warning(f"missing header on {message_dict['replay_id']}")
        return

    # Replace the first part with itself but the headers removed.
    recording_segment_parts[0] = parsed_first_part

    # The parts were gzipped by the SDK and disassembled by Relay. In this step we can
    # blindly merge the bytes objects into a single bytes object.
    recording_segment = b"".join(recording_segment_parts)

    # Upload the recording segment to blob storage.
    recording_segment_file_name = _make_recording_segment_filename(
        message_dict["replay_id"], headers["segment_id"]
    )
    file = File.objects.create(
        name=recording_segment_file_name,
        type="replay.recording",
    )
    file.putfile(
        BytesIO(recording_segment),
        blob_size=settings.SENTRY_ATTACHMENT_BLOB_SIZE,
    )
    ReplayRecordingSegment.objects.create(
        replay_id=message_dict["replay_id"],
        project_id=message_dict["project_id"],
        segment_id=headers["segment_id"],
        file_id=file.id,
    )

    # Clean up the cache.
    parts.drop()


def ingest_recording_segment_chunk(message_dict: RecordingSegmentChunkMessage):
    cache_prefix = _make_replay_recording_segment_cache_id(
        project_id=message_dict["project_id"],
        replay_id=message_dict["replay_id"],
        segment_id=message_dict["id"],
    )

    part = RecordingSegmentPart(cache_prefix)
    part[message_dict["chunk_index"]] = message_dict["payload"]


def _process_headers(recording_segment_with_headers: bytes) -> Tuple[dict, bytes]:
    try:
        recording_headers, recording_segment = recording_segment_with_headers.split(b"\n", 1)
    except ValueError:
        raise MissingRecordingSegmentHeaders

    return json.loads(recording_headers), recording_segment


def _make_recording_segment_filename(replay_id: str, segment_id: int):
    return f"rr:{replay_id}:{segment_id}"


def _make_replay_recording_segment_cache_id(
    project_id: int, replay_id: str, segment_id: str
) -> str:
    return f"{project_id}:{replay_id}:{segment_id}"
