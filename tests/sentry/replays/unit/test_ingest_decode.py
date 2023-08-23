import uuid

import msgpack

from sentry.replays.usecases.ingest.decode import decode_recording_message


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
