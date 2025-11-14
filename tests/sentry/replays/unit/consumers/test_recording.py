import zlib
from typing import int, Any

import msgpack
import pytest

from sentry.replays.consumers.recording import (
    DropSilently,
    decompress_segment,
    parse_headers,
    parse_recording_event,
    parse_request_message,
    process_message,
)
from sentry.replays.usecases.ingest import ProcessedEvent
from sentry.replays.usecases.ingest.event_parser import ParsedEventMeta
from sentry.replays.usecases.pack import pack
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json


def test_decompress_segment_success() -> None:
    """Test successful decompression of segment"""
    data = b"[hello, world!]"
    compressed_data = zlib.compress(data)

    compressed, decompressed = decompress_segment(compressed_data)
    assert compressed == compressed_data
    assert decompressed == data

    compressed, decompressed = decompress_segment(data)
    assert compressed == compressed_data
    assert decompressed == data


def test_decompress_segment_already_decompressed() -> None:
    """Test handling of already decompressed JSON data"""
    data = b"[hello, world!]"
    compressed_data = zlib.compress(data)

    compressed, decompressed = decompress_segment(data)
    assert compressed == compressed_data
    assert decompressed == data


def test_decompress_segment_unexpected_start_character() -> None:
    """Test handling of invalid data that can't be decompressed"""
    with pytest.raises(DropSilently):
        decompress_segment(b"hello, world!")


def test_decompress_segment_empty_data() -> None:
    """Test handling of empty data"""
    with pytest.raises(DropSilently):
        decompress_segment(b"")


def test_parse_headers_success() -> None:
    """Test successful parsing of headers"""
    recording = json.dumps({"segment_id": 42}).encode() + b"\n" + b"hello, world"

    segment_id, payload = parse_headers(recording, "1")
    assert segment_id == 42
    assert payload == b"hello, world"


def test_parse_headers_success_invalid_type() -> None:
    """Test parsing headers with invalid segment-id value"""
    recording = json.dumps({"segment_id": None}).encode() + b"\n" + b"hello, world"
    with pytest.raises(DropSilently):
        parse_headers(recording, "1")


def test_parse_headers_no_newline() -> None:
    """Test parsing headers without newline separator"""
    with pytest.raises(DropSilently):
        parse_headers(b'{"segment_id": 42}', "1")


def test_parse_headers_invalid_json() -> None:
    """Test parsing headers with invalid JSON"""
    with pytest.raises(DropSilently):
        parse_headers(b"hello\nworld", "1")


def test_parse_headers_missing_segment_id() -> None:
    """Test parsing headers missing segment_id field"""
    with pytest.raises(DropSilently):
        parse_headers(b'{"other_field": "value"}\nworld', "1")


def test_parse_headers_empty_recording() -> None:
    """Test parsing empty recording"""
    with pytest.raises(DropSilently):
        parse_headers(b"", "1")


def test_parse_request_message_success() -> None:
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


def test_parse_request_message_validation_error() -> None:
    """Test ValidationError raises DropSilently"""
    with pytest.raises(DropSilently):
        parse_request_message(msgpack.packb(b"invalid"))


def test_parse_recording_event_success() -> None:
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
            "replay_id": "test-replay-id",
            "retention_days": 30,
            "segment_id": 42,
            "should_publish_replay_event": False,
        },
        "payload_compressed": compressed_payload,
        "payload": original_payload,
        "replay_event": None,
        "replay_video": b"",
    }

    assert result == expected


def test_parse_recording_event_with_replay_event() -> None:
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
            "replay_id": "test-replay-id",
            "retention_days": 30,
            "segment_id": 42,
            "should_publish_replay_event": False,
        },
        "payload_compressed": compressed_payload,
        "payload": original_payload,
        "replay_event": {},
        "replay_video": b"",
    }

    assert result == expected


def test_parse_recording_event_missing_payload() -> None:
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


def test_parse_recording_event_invalid_compression() -> None:
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


def test_parse_recording_event_invalid_headers() -> None:
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


@django_db_all
def test_process_message_compressed() -> None:
    """Test "process_message" function with compressed payload."""
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
        "replay_id": "1",
        "received": 2,
        "retention_days": 30,
        "payload": recording_payload,
        "key_id": 1,
        "replay_event": b"{}",
        "replay_video": b"",
        "version": 0,
    }

    processed_result = process_message(make_kafka_message(message))

    expected = ProcessedEvent(
        actions_event=ParsedEventMeta([], [], [], [], [], [], [], []),
        context={
            "key_id": 1,
            "org_id": 3,
            "project_id": 4,
            "received": 2,
            "replay_id": "1",
            "retention_days": 30,
            "segment_id": 42,
            "should_publish_replay_event": False,
        },
        filedata=b"x\x9c\x8b\xaeV*\xa9,HU\xb2RP*I-.Q\xd2QPJI,I\x04\xf1\x8b\xf3sS\x15R\xcbR\xf3J\x14\xc0B\xb5\xb1\x00F\x9f\x0e\x8d",
        filename="30/4/1/42",
        recording_size_uncompressed=len(original_payload),
        recording_size=len(compressed_payload),
        replay_event={},
        trace_items=[],
        video_size=None,
    )
    assert expected == processed_result


@django_db_all
def test_process_message_uncompressed() -> None:
    """Test "process_message" function with uncompressed payload."""
    # Create real compressed data
    original_payload = b'[{"type": "test", "data": "some event data"}]'
    compressed_payload = zlib.compress(original_payload)

    # Create real headers
    segment_id = 42
    headers = json.dumps({"segment_id": segment_id}).encode()
    recording_payload = headers + b"\n" + original_payload

    # Mock the recording data structure
    message = {
        "type": "replay_recording_not_chunked",
        "org_id": 3,
        "project_id": 4,
        "replay_id": "1",
        "received": 2,
        "retention_days": 30,
        "payload": recording_payload,
        "key_id": 1,
        "replay_event": b"{}",
        "replay_video": b"",
        "version": 0,
    }

    processed_result = process_message(make_kafka_message(message))

    expected = ProcessedEvent(
        actions_event=ParsedEventMeta([], [], [], [], [], [], [], []),
        context={
            "key_id": 1,
            "org_id": 3,
            "project_id": 4,
            "received": 2,
            "replay_id": "1",
            "retention_days": 30,
            "segment_id": 42,
            "should_publish_replay_event": False,
        },
        filedata=b"x\x9c\x8b\xaeV*\xa9,HU\xb2RP*I-.Q\xd2QPJI,I\x04\xf1\x8b\xf3sS\x15R\xcbR\xf3J\x14\xc0B\xb5\xb1\x00F\x9f\x0e\x8d",
        filename="30/4/1/42",
        recording_size_uncompressed=len(original_payload),
        recording_size=len(compressed_payload),
        replay_event={},
        trace_items=[],
        video_size=None,
    )
    assert expected == processed_result


@django_db_all
def test_process_message_compressed_with_video() -> None:
    """Test "process_message" function with compressed payload and a video."""
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
        "replay_id": "1",
        "received": 2,
        "retention_days": 30,
        "payload": recording_payload,
        "key_id": 1,
        "replay_event": b"{}",
        "replay_video": b"hello",
        "version": 0,
    }

    processed_result = process_message(make_kafka_message(message))

    expected = ProcessedEvent(
        actions_event=ParsedEventMeta([], [], [], [], [], [], [], []),
        context={
            "key_id": 1,
            "org_id": 3,
            "project_id": 4,
            "received": 2,
            "replay_id": "1",
            "retention_days": 30,
            "segment_id": 42,
            "should_publish_replay_event": False,
        },
        filedata=zlib.compress(pack(original_payload, b"hello")),
        filename="30/4/1/42",
        recording_size_uncompressed=len(original_payload),
        recording_size=len(compressed_payload),
        replay_event={},
        trace_items=[],
        video_size=5,
    )
    assert expected == processed_result


def test_process_message_invalid_message() -> None:
    """Test "process_message" function with invalid message."""
    assert process_message(make_kafka_message(b"")) is None


def test_process_message_invalid_recording_json() -> None:
    """Test "process_message" function with invalid recording json."""
    message = {
        "type": "replay_recording_not_chunked",
        "org_id": 3,
        "project_id": 4,
        "replay_id": "1",
        "received": 2,
        "retention_days": 30,
        "payload": json.dumps({"segment_id": 42}).encode() + b"\n" + b"t",
        "key_id": 1,
        "replay_event": b"{}",
        "replay_video": b"",
        "version": 0,
    }

    kafka_message = make_kafka_message(message)
    assert process_message(kafka_message) is None


def test_process_message_invalid_headers() -> None:
    """Test "process_message" function with invalid headers."""
    message = {
        "type": "replay_recording_not_chunked",
        "org_id": 3,
        "project_id": 4,
        "replay_id": "1",
        "received": 2,
        "retention_days": 30,
        "payload": json.dumps({"hello": "world"}).encode() + b"\n" + b"[]",
        "key_id": 1,
        "replay_event": b"{}",
        "replay_video": b"",
        "version": 0,
    }

    kafka_message = make_kafka_message(message)
    assert process_message(kafka_message) is None


def test_process_message_malformed_headers() -> None:
    """Test "process_message" function with malformed headers."""
    message = {
        "type": "replay_recording_not_chunked",
        "org_id": 3,
        "project_id": 4,
        "replay_id": "1",
        "received": 2,
        "retention_days": 30,
        "payload": b"hello, world!" + b"\n" + b"[]",
        "key_id": 1,
        "replay_event": b"{}",
        "replay_video": b"",
        "version": 0,
    }

    kafka_message = make_kafka_message(message)
    assert process_message(kafka_message) is None


def test_process_message_malformed_headers_invalid_unicode_codepoint() -> None:
    """Test "process_message" function with malformed unicode codepoint in headers."""
    message = {
        "type": "replay_recording_not_chunked",
        "org_id": 3,
        "project_id": 4,
        "replay_id": "1",
        "received": 2,
        "retention_days": 30,
        "payload": '{"segment_id":"\\ud83c"}\n'.encode("utf-16") + b"[]",
        "key_id": 1,
        "replay_event": b"{}",
        "replay_video": b"",
        "version": 0,
    }

    kafka_message = make_kafka_message(message)
    assert process_message(kafka_message) is None


def test_process_message_no_headers() -> None:
    """Test "process_message" function with no headers."""
    message = {
        "type": "replay_recording_not_chunked",
        "org_id": 3,
        "project_id": 4,
        "replay_id": "1",
        "received": 2,
        "retention_days": 30,
        "payload": b"[]",
        "key_id": 1,
        "replay_event": b"{}",
        "replay_video": b"",
        "version": 0,
    }

    kafka_message = make_kafka_message(message)
    assert process_message(kafka_message) is None


def make_kafka_message(message: bytes | dict[str, Any]) -> bytes:
    return msgpack.packb(message)
