from __future__ import annotations

import logging
import typing

import msgpack
from sentry_kafka_schemas import codecs, get_codec

from sentry.utils import json, metrics

logger = logging.getLogger()

RECORDINGS_CODEC = get_codec("ingest-replay-recordings")


class MissingRecordingSegmentHeaders(ValueError):
    pass


class RecordingSegment(typing.TypedDict):
    key_id: int | None
    org_id: int
    payload: bytes
    project_id: int
    received: int
    replay_id: str
    retention_days: int
    segment_id: int


class RecordingSegmentHeaders(typing.TypedDict):
    segment_id: int


def decode_recording_message(message: bytes) -> RecordingSegment | None:
    """Optionally return a decoded RecordingSegment message type."""
    try:
        message_dict = RECORDINGS_CODEC.decode(message)
    except (codecs.ValidationError, msgpack.exceptions.ExtraData):
        logger.exception("Invalid replay recording payload.")
        return None

    try:
        headers, payload = process_headers(message_dict["payload"])
    except MissingRecordingSegmentHeaders:
        logger.warning(f'missing header on {message_dict["replay_id"]}')
        return None

    return {
        "key_id": message_dict["key_id"],
        "org_id": message_dict["org_id"],
        "payload": payload,
        "project_id": message_dict["project_id"],
        "received": message_dict["received"],
        "replay_id": message_dict["replay_id"],
        "retention_days": message_dict["retention_days"],
        "segment_id": headers["segment_id"],
    }


@metrics.wraps("replays.usecases.ingest.process_headers")
def process_headers(recording_bytes: bytes) -> tuple[RecordingSegmentHeaders, bytes]:
    try:
        recording_headers, recording_segment = recording_bytes.split(b"\n", 1)
    except ValueError:
        raise MissingRecordingSegmentHeaders("Missing recording-segment headers")
    else:
        return json.loads(recording_headers, use_rapid_json=True), recording_segment
