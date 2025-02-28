import time
import uuid
import zlib

import msgpack
from arroyo.types import Partition
from arroyo.types import Topic as ArroyoTopic
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.ingest_replay_recordings_v1 import ReplayRecording

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.replays.consumers.buffered.consumer import process_message, recording_runtime
from sentry.replays.usecases.ingest import ProcessedRecordingMessage
from sentry.replays.usecases.ingest.event_parser import ParsedEventMeta
from tests.sentry.replays.unit.consumers.test_helpers import MockCommit, make_kafka_message

RECORDINGS_CODEC: Codec[ReplayRecording] = get_topic_codec(Topic.INGEST_REPLAYS_RECORDINGS)


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

    expected_event_metadata = ParsedEventMeta([], [], [], [], [], [])
    assert result is not None
    assert result == ProcessedRecordingMessage(
        actions_event=expected_event_metadata,
        filedata=zlib.compress(b"[]"),
        filename=result.filename,
        is_replay_video=False,
        key_id=3,
        org_id=1,
        project_id=2,
        received=result.received,
        recording_size_uncompressed=2,
        recording_size=result.recording_size,
        retention_days=30,
        replay_id=result.replay_id,
        segment_id=0,
        video_size=None,
        replay_event=None,
    )


def test_process_message_invalid():
    result = process_message(msgpack.packb(b"hello, world!"))
    assert result is None


def test_commit_invalid_message():
    """Assert invalid messages have their offsets staged for commit."""
    mock_commit = MockCommit()

    recording_runtime.setup(
        {"max_buffer_length": 100, "max_buffer_wait": 100, "max_workers": 1}, mock_commit
    )

    message: ReplayRecording = {
        "key_id": None,
        "org_id": 1,
        "payload": b"invalid",
        "project_id": 1,
        "received": int(time.time()),
        "replay_event": None,
        "replay_id": uuid.uuid4().hex,
        "replay_video": None,
        "retention_days": 30,
        "type": "replay_recording_not_chunked",
        "version": 1,
    }

    message = RECORDINGS_CODEC.encode(message)
    kafka_message = make_kafka_message(message)

    recording_runtime.submit(kafka_message)
    assert recording_runtime.model.offsets == {Partition(ArroyoTopic("a"), 1): 2}
    assert mock_commit.commit == {}
