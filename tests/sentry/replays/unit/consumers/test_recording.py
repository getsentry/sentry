import zlib

import msgpack
import pytest

from sentry.replays.consumers.recording import (
    DropSilently,
    decompress_segment,
    parse_headers,
    parse_recording_event,
    parse_request_message,
)
from sentry.utils import json


def test_decompress_segment_success():
    """Test successful decompression of segment"""
    data = b"[hello, world!]"
    compressed_data = zlib.compress(data)

    compressed, decompressed = decompress_segment(compressed_data)
    assert compressed == compressed_data
    assert decompressed == data

    compressed, decompressed = decompress_segment(data)
    assert compressed == compressed_data
    assert decompressed == data


def test_decompress_segment_already_decompressed():
    """Test handling of already decompressed JSON data"""
    data = b"[hello, world!]"
    compressed_data = zlib.compress(data)

    compressed, decompressed = decompress_segment(data)
    assert compressed == compressed_data
    assert decompressed == data


def test_decompress_segment_unexpected_start_character():
    """Test handling of invalid data that can't be decompressed"""
    with pytest.raises(DropSilently):
        decompress_segment(b"hello, world!")


def test_decompress_segment_empty_data():
    """Test handling of empty data"""
    with pytest.raises(DropSilently):
        decompress_segment(b"")


def test_parse_headers_success():
    """Test successful parsing of headers"""
    recording = json.dumps({"segment_id": 42}).encode() + b"\n" + b"hello, world"

    segment_id, payload = parse_headers(recording, "1")
    assert segment_id == 42
    assert payload == b"hello, world"


def test_parse_headers_no_newline():
    """Test parsing headers without newline separator"""
    with pytest.raises(DropSilently):
        parse_headers(b'{"segment_id": 42}', "1")


def test_parse_headers_invalid_json():
    """Test parsing headers with invalid JSON"""
    with pytest.raises(DropSilently):
        parse_headers(b"hello\nworld", "1")


def test_parse_headers_missing_segment_id():
    """Test parsing headers missing segment_id field"""
    with pytest.raises(DropSilently):
        parse_headers(b'{"other_field": "value"}\nworld', "1")


def test_parse_headers_empty_recording():
    """Test parsing empty recording"""
    with pytest.raises(DropSilently):
        parse_headers(b"", b"1")


def test_parse_request_message_success():
    """Test successful parsing of request message"""
    message = {
        "type": "replay_recording_not_chunked",
        "org_id": 123,
        "project_id": 456,
        "replay_id": "test-replay-id",
        "received": 1234567890,
        "retention_days": 30,
        "payload": b"test payload",
        "version": 0,
    }

    result = parse_request_message(msgpack.packb(message))
    assert result == message


def test_parse_request_message_validation_error():
    """Test ValidationError raises DropSilently"""
    with pytest.raises(DropSilently):
        parse_request_message(msgpack.packb(b"invalid"))


def test_parse_recording_event_success():
    """Test successful parsing of recording event end-to-end"""
    # Create real compressed data
    original_payload = b'[{"type": "test", "data": "some event data"}]'
    compressed_payload = zlib.compress(original_payload)

    # Create real headers
    segment_id = 42
    headers = json.dumps({"segment_id": segment_id}).encode()
    recording_payload = headers + b"\n" + compressed_payload

    # Mock the recording data structure
    message = {
        "type": "replay_recording_not_chunked",
        "org_id": 3,
        "project_id": 4,
        "replay_id": "test-replay-id",
        "received": 2,
        "retention_days": 30,
        "payload": recording_payload,
        "key_id": 1,
        "replay_video": b"",
        "version": 0,
    }

    result = parse_recording_event(msgpack.packb(message))

    expected = {
        "context": {
            "key_id": 1,
            "org_id": 3,
            "project_id": 4,
            "received": 2,
            "retention_days": 30,
            "segment_id": 42,
        },
        "payload_compressed": compressed_payload,
        "payload": original_payload,
        "replay_event": None,
        "replay_id": "test-replay-id",
        "replay_video": b"",
    }

    assert result == expected


def test_parse_recording_event_with_replay_event():
    """Test parsing recording event with replay_event JSON"""
    # Create real compressed data
    original_payload = b'[{"type": "test", "data": "some event data"}]'
    compressed_payload = zlib.compress(original_payload)

    # Create real headers
    segment_id = 42
    headers = json.dumps({"segment_id": segment_id}).encode()
    recording_payload = headers + b"\n" + compressed_payload

    # Mock the recording data structure
    message = {
        "type": "replay_recording_not_chunked",
        "org_id": 3,
        "project_id": 4,
        "replay_id": "test-replay-id",
        "received": 2,
        "retention_days": 30,
        "payload": recording_payload,
        "key_id": 1,
        "replay_event": b"{}",
        "replay_video": b"",
        "version": 0,
    }

    result = parse_recording_event(msgpack.packb(message))

    expected = {
        "context": {
            "key_id": 1,
            "org_id": 3,
            "project_id": 4,
            "received": 2,
            "retention_days": 30,
            "segment_id": 42,
        },
        "payload_compressed": compressed_payload,
        "payload": original_payload,
        "replay_id": "test-replay-id",
        "replay_event": {},
        "replay_video": b"",
    }

    assert result == expected


def test_parse_recording_event_missing_payload():
    """Test that missing payload cause DropSilently"""
    message = {
        "type": "replay_recording_not_chunked",
        "org_id": 123,
        "project_id": 456,
        "replay_id": "test-replay-id",
        "received": 1234567890,
        "retention_days": 30,
        "payload": b'{"segment_id": 42}',  # Missing newline separator
        "version": 0,
    }
    with pytest.raises(DropSilently):
        parse_recording_event(msgpack.packb(message))


def test_parse_recording_event_invalid_compression():
    """Test that invalid compression in payload causes DropSilently"""
    message = {
        "type": "replay_recording_not_chunked",
        "org_id": 123,
        "project_id": 456,
        "replay_id": "test-replay-id",
        "received": 1234567890,
        "retention_days": 30,
        "payload": json.dumps({"segment_id": 42}).encode() + b"\ninvalid",
        "version": 0,
    }
    with pytest.raises(DropSilently):
        parse_recording_event(msgpack.packb(message))


def test_parse_recording_event_invalid_headers():
    """Test that invalid headers in payload causes DropSilently"""
    message = {
        "type": "replay_recording_not_chunked",
        "org_id": 123,
        "project_id": 456,
        "replay_id": "test-replay-id",
        "received": 1234567890,
        "retention_days": 30,
        "payload": json.dumps({"hello": "world"}).encode() + b"\n" + zlib.compress(b"t"),
        "version": 0,
    }
    with pytest.raises(DropSilently):
        parse_recording_event(msgpack.packb(message))
