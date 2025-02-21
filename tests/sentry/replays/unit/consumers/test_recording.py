import time
import uuid

import msgpack

from sentry.replays.consumers.buffered.consumer import process_message
from sentry.replays.usecases.ingest import ProcessedRecordingMessage


def test_process_message_invalid():
    result = process_message(msgpack.packb(b"hello, world!"))
    assert result is None


def test_process_message():
    result = process_message(
        msgpack.packb(
            {
                "type": "replay_recording_not_chunked",
                "replay_id": uuid.uuid4().hex,
                "org_id": 1,
                "key_id": 3,
                "project_id": 2,
                "received": int(time.time()),
                "retention_days": 30,
                "payload": b'{"segment_id":0}\n[]',
                "replay_event": None,
                "replay_video": None,
            }
        )
    )
    assert result is not None
    assert result == ProcessedRecordingMessage(
        actions_event=[],
        filedata=b"[]",
        filename=result.filename,
        is_replay_video=False,
        key_id=3,
        org_id=1,
        project_id=2,
        received=result.received,
        recording_size_uncompressed=2,
        recording_size=result.recording_size,
        replay_id=result.replay_id,
        segment_id=0,
        video_size=None,
    )
