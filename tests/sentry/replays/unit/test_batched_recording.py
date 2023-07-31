import uuid

import msgpack

from sentry.replays.usecases.ingest.batched_recording import (
    ProcessedRecordingSegment,
    RecordingSegment,
    decode_recording_message,
    prepare_batched_commit,
    prepare_recording_message_batch_item,
)
from sentry.utils.crypt_envelope import envelope_decrypt


def test_prepare_batched_commit():
    """Test "prepare_batched_commit" function."""
    replay_id = uuid.uuid4().hex

    first: ProcessedRecordingSegment = {
        "dek": b"a",
        "encrypted_message": b"hello",
        "kek": b"1",
        "key": f"{replay_id}0",
    }

    second: ProcessedRecordingSegment = {
        "dek": b"a",
        "encrypted_message": b"world",
        "kek": b"1",
        "key": f"{replay_id}1",
    }

    result = prepare_batched_commit([first, second])

    # Assert the basic structure of the batched commit is present.
    assert result["filename"] is not None
    assert len(result["rows"]) == 2
    assert result["payload"] == b"helloworld"

    # Assert non-overlapping ranges of bytes.
    assert result["rows"][0]["start"] == 0
    assert result["rows"][1]["start"] == 5
    assert result["rows"][0]["end"] == 4
    assert result["rows"][1]["end"] == 9


def test_process_batched_recording_message():
    """Test "process_batched_recording_message" function."""
    segment: RecordingSegment = {
        "key_id": 1,
        "org_id": 1,
        "payload": b"hello",
        "project_id": 1,
        "received": 1,
        "replay_id": uuid.uuid4().hex,
        "retention_days": 30,
        "segment_id": 0,
    }

    processed_segment = prepare_recording_message_batch_item(segment)
    assert isinstance(processed_segment["kek"], bytes)
    assert isinstance(processed_segment["dek"], bytes)
    assert isinstance(processed_segment["encrypted_message"], bytes)
    assert processed_segment["key"] == f'{segment["replay_id"]}{segment["segment_id"]}'

    decrypted_message = envelope_decrypt(
        processed_segment["kek"], processed_segment["dek"], processed_segment["encrypted_message"]
    )
    assert decrypted_message == b"hello"


def test_decode_recording_message():
    """Test "decode_recording_message" function."""
    message = msgpack.packb(
        {
            "type": "replay_recording_not_chunked",
            "key_id": 1,
            "org_id": 1,
            "payload": b'{"segment_id":1}\nhello',
            "project_id": 1,
            "received": 1,
            "replay_id": uuid.uuid4().hex,
            "retention_days": 30,
        }
    )

    result = decode_recording_message(message)
    assert result is not None
    assert result["payload"] == b"hello"
    assert result["segment_id"] == 1


def test_decode_recording_message_invalid_payload():
    """Test "decode_recording_message" function with invalid payload."""
    # Message had a malformed payload value.
    message = msgpack.packb(
        {
            "type": "replay_recording_not_chunked",
            "key_id": 1,
            "org_id": 1,
            "payload": b"hello",
            "project_id": 1,
            "received": 1,
            "replay_id": uuid.uuid4().hex,
            "retention_days": 30,
        }
    )
    assert decode_recording_message(message) is None

    # Message does not match schema.
    assert decode_recording_message(msgpack.packb({"hello": "world"})) is None

    # Message was not msgpack encoded.
    assert decode_recording_message(b"hello") is None
