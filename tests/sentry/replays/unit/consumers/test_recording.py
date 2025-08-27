import zlib
from unittest.mock import patch

import msgpack
import pytest
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.types import FilteredPayload, Message, Value
from django.test import override_settings

from sentry.replays.consumers.recording import (
    DropSilently,
    ProcessReplayRecordingStrategyFactory,
    commit_message_with_profiling,
    decompress_segment,
    parse_headers,
    parse_recording_event,
    parse_request_message,
    process_message,
    process_message_with_profiling,
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
        actions_event=ParsedEventMeta([], [], [], [], [], []),
        context={
            "key_id": 1,
            "org_id": 3,
            "project_id": 4,
            "received": 2,
            "replay_id": "1",
            "retention_days": 30,
            "segment_id": 42,
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
        actions_event=ParsedEventMeta([], [], [], [], [], []),
        context={
            "key_id": 1,
            "org_id": 3,
            "project_id": 4,
            "received": 2,
            "replay_id": "1",
            "retention_days": 30,
            "segment_id": 42,
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
        actions_event=ParsedEventMeta([], [], [], [], [], []),
        context={
            "key_id": 1,
            "org_id": 3,
            "project_id": 4,
            "received": 2,
            "replay_id": "1",
            "retention_days": 30,
            "segment_id": 42,
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
    assert process_message(make_kafka_message(b"")) == FilteredPayload()


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
    assert process_message(kafka_message) == FilteredPayload()


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
    assert process_message(kafka_message) == FilteredPayload()


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
    assert process_message(kafka_message) == FilteredPayload()


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
    assert process_message(kafka_message) == FilteredPayload()


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
    assert process_message(kafka_message) == FilteredPayload()


def make_kafka_message(message) -> Message[KafkaPayload]:
    return Message(Value(KafkaPayload(key=None, value=msgpack.packb(message), headers=[]), {}))


def make_processed_event_message(processed_event: ProcessedEvent) -> Message[ProcessedEvent]:
    return Message(Value(processed_event, {}))


def make_valid_message() -> Message[KafkaPayload]:
    original_payload = b'[{"type": "test", "data": "some event data"}]'
    compressed_payload = zlib.compress(original_payload)
    segment_id = 42
    headers = json.dumps({"segment_id": segment_id}).encode()
    recording_payload = headers + b"\n" + compressed_payload

    return make_kafka_message(
        {
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
    )


def make_valid_processed_event() -> ProcessedEvent:
    original_payload = b'[{"type": "test", "data": "some event data"}]'
    compressed_payload = zlib.compress(original_payload)

    return ProcessedEvent(
        actions_event=ParsedEventMeta([], [], [], [], [], []),
        context={
            "key_id": 1,
            "org_id": 3,
            "project_id": 4,
            "received": 2,
            "replay_id": "1",
            "retention_days": 30,
            "segment_id": 42,
        },
        filedata=compressed_payload,
        filename="30/4/1/42",
        recording_size_uncompressed=len(original_payload),
        recording_size=len(compressed_payload),
        replay_event={},
        trace_items=[],
        video_size=None,
    )


@pytest.mark.parametrize("dsn", ["http://test@localhost:8000/1", None])
@pytest.mark.parametrize("sample_rate", [1.0, 0])
@pytest.mark.parametrize("profiling_enabled", [True, False])
@patch("sentry.options.get")  # for mocking replay.consumer.recording.profiling.enabled
@patch("sentry_sdk.profiler.start_profiler")
@patch("sentry_sdk.profiler.stop_profiler")
@patch("sentry.replays.consumers.recording.process_message")
def test_process_message_with_profiling(
    mock_process_message,
    mock_stop_profiler,
    mock_start_profiler,
    mock_options_get,
    dsn,
    sample_rate,
    profiling_enabled,
):
    mock_process_message.return_value = FilteredPayload()
    mock_options_get.return_value = profiling_enabled

    message = make_valid_message()

    settings_overrides = {
        "SENTRY_REPLAY_RECORDINGS_CONSUMER_PROFILING_PROJECT_DSN": dsn,
        "SENTRY_REPLAY_RECORDINGS_CONSUMER_TRACES_SAMPLE_RATE": 0,
        "SENTRY_REPLAY_RECORDINGS_CONSUMER_PROFILING_SAMPLE_RATE": sample_rate,
    }

    with override_settings(**settings_overrides):
        result = process_message_with_profiling(message)

    assert result == FilteredPayload()
    mock_process_message.assert_called_once_with(message)

    profiling_active = profiling_enabled and dsn is not None and sample_rate > 0
    if profiling_active:
        mock_start_profiler.assert_called_once()
        mock_stop_profiler.assert_called_once()
    else:
        mock_start_profiler.assert_not_called()
        mock_stop_profiler.assert_not_called()


@pytest.mark.parametrize("dsn", ["http://test@localhost:8000/1", None])
@pytest.mark.parametrize("sample_rate", [1.0, 0])
@pytest.mark.parametrize("profiling_enabled", [True, False])
@patch("sentry.options.get")  # for mocking replay.consumer.recording.profiling.enabled
@patch("sentry_sdk.profiler.start_profiler")
@patch("sentry_sdk.profiler.stop_profiler")
@patch("sentry.replays.consumers.recording.commit_message")
def test_commit_message_with_profiling(
    mock_commit_message,
    mock_stop_profiler,
    mock_start_profiler,
    mock_options_get,
    dsn,
    sample_rate,
    profiling_enabled,
):
    processed_event = make_valid_processed_event()
    message = make_processed_event_message(processed_event)
    mock_options_get.return_value = profiling_enabled

    settings_overrides = {
        "SENTRY_REPLAY_RECORDINGS_CONSUMER_PROFILING_PROJECT_DSN": dsn,
        "SENTRY_REPLAY_RECORDINGS_CONSUMER_TRACES_SAMPLE_RATE": 0,
        "SENTRY_REPLAY_RECORDINGS_CONSUMER_PROFILING_SAMPLE_RATE": sample_rate,
    }

    with override_settings(**settings_overrides):
        commit_message_with_profiling(message)

    mock_commit_message.assert_called_once_with(message)

    profiling_active = profiling_enabled and dsn is not None and sample_rate > 0
    if profiling_active:
        mock_start_profiler.assert_called_once()
        mock_stop_profiler.assert_called_once()
    else:
        mock_start_profiler.assert_not_called()
        mock_stop_profiler.assert_not_called()


@pytest.mark.parametrize("dsn", ["http://test@localhost:8000/1", None])
@pytest.mark.parametrize("sample_rate", [1.0, 0])
@pytest.mark.parametrize("profiling_enabled", [True, False])
@patch("sentry.options.get")  # for mocking replay.consumer.recording.profiling.enabled
@patch("sentry_sdk.init")
def test_strategy_factory_sentry_sdk_initialization(
    mock_sdk_init,
    mock_options_get,
    dsn,
    sample_rate,
    profiling_enabled,
):
    """Test that Sentry SDK is initialized only when profiling is enabled."""
    mock_options_get.return_value = profiling_enabled

    settings_overrides = {
        "SENTRY_REPLAY_RECORDINGS_CONSUMER_PROFILING_PROJECT_DSN": dsn,
        "SENTRY_REPLAY_RECORDINGS_CONSUMER_TRACES_SAMPLE_RATE": 0.1,
        "SENTRY_REPLAY_RECORDINGS_CONSUMER_PROFILING_SAMPLE_RATE": sample_rate,
    }

    with override_settings(**settings_overrides):
        ProcessReplayRecordingStrategyFactory(
            input_block_size=None,
            max_batch_size=100,
            max_batch_time=1000,
            num_processes=1,
            output_block_size=None,
            num_threads=4,
        )

    profiling_active = profiling_enabled and dsn is not None and sample_rate > 0
    if profiling_active:
        mock_sdk_init.assert_called_once()
        call_args = mock_sdk_init.call_args
        assert call_args[1]["dsn"] == dsn
        assert call_args[1]["traces_sample_rate"] == 0.1
        assert call_args[1]["profile_session_sample_rate"] == sample_rate
        assert call_args[1]["profile_lifecycle"] == "manual"
    else:
        mock_sdk_init.assert_not_called()


@pytest.mark.parametrize(
    "client_dsn,expected_sdk_init_called,expected_dsn",
    [
        # different DSN -> reinitialize
        pytest.param(
            "http://different@localhost:8000/1",
            True,
            "http://test@localhost:8000/1",
            id="dsn_changes",
        ),
        # DSN is None -> reinitialize
        pytest.param(
            None,
            True,
            "http://test@localhost:8000/1",
            id="dsn_none",
        ),
        # same DSN -> don't reinitialize
        pytest.param(
            "http://test@localhost:8000/1",
            False,
            None,
            id="dsn_same",
        ),
    ],
)
@patch(
    "sentry.options.get", return_value=True
)  # ensure replay.consumer.recording.profiling.enabled is True, ie profiling enabled
@patch("sentry_sdk.init")
@patch("sentry_sdk.get_client")
def test_strategy_factory_sentry_sdk_reinitialization(
    mock_get_client,
    mock_sdk_init,
    mock_options_get,
    client_dsn,
    expected_sdk_init_called,
    expected_dsn,
):
    """Test that Sentry is reinitialized when DSN changes or is None, but not when it stays the same."""
    mock_client = mock_get_client.return_value
    mock_client.dsn = client_dsn

    settings_overrides = {
        "SENTRY_REPLAY_RECORDINGS_CONSUMER_PROFILING_PROJECT_DSN": "http://test@localhost:8000/1",
        "SENTRY_REPLAY_RECORDINGS_CONSUMER_TRACES_SAMPLE_RATE": 0.1,
        "SENTRY_REPLAY_RECORDINGS_CONSUMER_PROFILING_SAMPLE_RATE": 0.5,
    }

    with override_settings(**settings_overrides):
        ProcessReplayRecordingStrategyFactory(
            input_block_size=None,
            max_batch_size=100,
            max_batch_time=1000,
            num_processes=1,
            output_block_size=None,
            num_threads=4,
        )

    if expected_sdk_init_called:
        mock_sdk_init.assert_called_once()
        call_args = mock_sdk_init.call_args
        assert call_args[1]["dsn"] == expected_dsn
    else:
        mock_sdk_init.assert_not_called()


@patch("sentry.replays.consumers.recording.sentry_sdk.get_client")
@patch(
    "sentry.options.get", return_value=True
)  # ensure replay.consumer.recording.profiling.enabled is True, ie profiling enabled
@patch("sentry_sdk.init")
def test_strategy_factory_sentry_sdk_reinitializes_on_exception(
    mock_sdk_init, mock_options_get, mock_get_client
):
    """Test that exception when getting client triggers SDK initialization."""
    # If we just mock a side_effect exception, it will interfere with Django's test setup and break before even getting to this test
    # Instead let's just mock a client missing the dsn attribute to raise an AttributeError when accessing sentry_sdk.get_client().dsn
    mock_client = mock_get_client.return_value
    del mock_client.dsn

    settings_overrides = {
        "SENTRY_REPLAY_RECORDINGS_CONSUMER_PROFILING_PROJECT_DSN": "http://test@localhost:8000/1",
        "SENTRY_REPLAY_RECORDINGS_CONSUMER_TRACES_SAMPLE_RATE": 0.1,
        "SENTRY_REPLAY_RECORDINGS_CONSUMER_PROFILING_SAMPLE_RATE": 0.5,
    }

    with override_settings(**settings_overrides):
        ProcessReplayRecordingStrategyFactory(
            input_block_size=None,
            max_batch_size=100,
            max_batch_time=1000,
            num_processes=1,
            output_block_size=None,
            num_threads=4,
        )

    mock_sdk_init.assert_called_once()
    call_args = mock_sdk_init.call_args
    assert call_args[1]["dsn"] == "http://test@localhost:8000/1"
