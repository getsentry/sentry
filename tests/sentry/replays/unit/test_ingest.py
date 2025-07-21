import zlib

import pytest

from sentry.replays.usecases.ingest import (
    Event,
    extract_trace_id,
    pack_replay_video,
    parse_replay_events,
    process_recording_event,
)
from sentry.replays.usecases.ingest.event_parser import ParsedEventMeta
from sentry.replays.usecases.pack import unpack


def test_process_recording_event_without_video():
    """Test process_recording_event without replay video data"""
    payload = b'[{"type": "test"}]'
    payload_compressed = zlib.compress(payload)

    message: Event = {
        "context": {
            "key_id": 123,
            "org_id": 1,
            "project_id": 456,
            "received": 1234567890,
            "replay_id": "test-replay-id",
            "retention_days": 30,
            "segment_id": 42,
        },
        "payload": payload,
        "payload_compressed": payload_compressed,
        "replay_event": None,
        "replay_video": None,
    }

    result = process_recording_event(message)

    assert result.actions_event == ParsedEventMeta([], [], [], [], [], [])
    assert result.context == message["context"]
    assert result.filename == "30/456/test-replay-id/42"
    assert result.filedata == payload_compressed
    assert result.recording_size_uncompressed == len(payload)
    assert result.recording_size == len(payload_compressed)
    assert result.replay_event is None
    assert result.video_size is None


def test_process_recording_event_with_video():
    """Test process_recording_event with replay video data"""
    payload = b'[{"type": "test"}]'
    payload_compressed = zlib.compress(payload)
    video_data = b"video"

    message: Event = {
        "context": {
            "key_id": 456,
            "org_id": 2,
            "project_id": 789,
            "received": 1234567890,
            "replay_id": "video-replay-id",
            "retention_days": 90,
            "segment_id": 1,
        },
        "payload": payload,
        "payload_compressed": payload_compressed,
        "replay_event": None,
        "replay_video": video_data,
    }

    result = process_recording_event(message)

    assert result.actions_event == ParsedEventMeta([], [], [], [], [], [])
    assert result.context == message["context"]
    assert result.filename == "90/789/video-replay-id/1"
    assert result.recording_size_uncompressed == len(payload)
    assert result.recording_size == len(payload_compressed)
    assert result.replay_event is None
    assert result.video_size == len(video_data)

    # Verify the filedata is packed replay video
    # We can verify by unpacking it
    unpacked_video, unpacked_rrweb = unpack(zlib.decompress(result.filedata))
    assert unpacked_rrweb == payload
    assert unpacked_video == video_data


def test_parse_replay_events_empty():
    (result, trace_items) = parse_replay_events(
        {
            "context": {
                "key_id": 1,
                "org_id": 1,
                "project_id": 1,
                "received": 1,
                "replay_id": "1",
                "retention_days": 1,
                "segment_id": 1,
            },
            "payload": b"[]",
            "payload_compressed": b"",
            "replay_event": None,
            "replay_video": None,
        }
    )
    assert result == ParsedEventMeta([], [], [], [], [], [])
    assert trace_items == []


def test_parse_replay_events_invalid_json():
    result = parse_replay_events(
        {
            "context": {
                "key_id": 1,
                "org_id": 1,
                "project_id": 1,
                "received": 1,
                "replay_id": "1",
                "retention_days": 1,
                "segment_id": 1,
            },
            "payload": b"hello, world!",
            "payload_compressed": b"",
            "replay_event": None,
            "replay_video": None,
        }
    )
    assert result is None


def test_pack_replay_video():
    result = pack_replay_video(b"hello", b"world")
    video, rrweb = unpack(zlib.decompress(result))
    assert rrweb == b"hello"
    assert video == b"world"


@pytest.mark.parametrize(
    "replay_event,expected",
    [
        ({"trace_ids": ["a"]}, "a"),
        ({"trace_ids": ["a", "a"]}, None),
        ({"trace_ids": []}, None),
        ({}, None),
        (None, None),
    ],
)
def test_extract_trace_id(replay_event, expected):
    """Test "extract_trace_id" function."""
    assert extract_trace_id(replay_event) == expected
