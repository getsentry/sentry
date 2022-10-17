import logging
from io import BytesIO
from typing import Tuple, TypedDict

from django.conf import settings

from sentry.models import File
from sentry.replays.cache import RecordingSegmentParts
from sentry.utils import json


class MissingRecordingSegmentHeaders(ValueError):
    pass


class ReplayRecordingSegment(TypedDict):
    id: str
    chunks: int


class RecordingSegmentMessage(TypedDict):
    replay_id: str
    project_id: int
    replay_recording: ReplayRecordingSegment


def ingest_recording_segment(message_dict: RecordingSegmentMessage) -> None:
    logger = logging.getLogger("sentry.replays")

    cache_prefix = make_replay_recording_segment_cache_id(
        project_id=message_dict["project_id"],
        replay_id=message_dict["replay_id"],
        segment_id=message_dict["replay_recording"]["id"],
    )
    parts = RecordingSegmentParts(
        prefix=cache_prefix, num_parts=message_dict["replay_recording"]["chunks"]
    )

    recording_segment_parts = parts.get_all()
    if not all(recording_segment_parts):
        logger.error(f"Missing recording-segments for: {parts.prefix}")
        return None

    try:
        headers, parsed_first_part = process_headers(recording_segment_parts[0])
    except MissingRecordingSegmentHeaders:
        logger.warning(f"missing header on {message_dict['replay_id']}")
        return

    # Replace the first part with itself but the headers removed.
    recording_segment_parts[0] = parsed_first_part

    # The parts were gzipped by the SDK and disassembled by Relay. In this step we can
    # blindly merge the bytes objects into a single bytes object.
    recording_segment = b"".join(recording_segment_parts)

    # Upload the recording segment to the blob store.
    recording_segment_file_name = make_recording_segment_filename(
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


def process_headers(recording_segment_with_headers: bytes) -> Tuple[dict, bytes]:
    try:
        recording_headers, recording_segment = recording_segment_with_headers.split(b"\n", 1)
    except ValueError:
        raise MissingRecordingSegmentHeaders

    return json.loads(recording_headers), recording_segment


def make_recording_segment_filename(replay_id: str, segment_id: int):
    return f"rr:{replay_id}:{segment_id}"


def make_replay_recording_segment_cache_id(project_id: int, replay_id: str, segment_id: str) -> str:
    return f"{project_id}:{replay_id}:{segment_id}"
