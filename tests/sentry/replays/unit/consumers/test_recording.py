import time
import uuid
import zlib

from arroyo.types import Partition
from arroyo.types import Topic as ArroyoTopic
from sentry_kafka_schemas.schema_types.ingest_replay_recordings_v1 import ReplayRecording

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.replays.consumers.buffered.consumer import (
    Committed,
    Flush,
    FlushBuffer,
    TryFlush,
    init,
    process,
    subscription,
    update,
)
from sentry.replays.consumers.buffered.platform import Commit, Effect, Nothing, Task
from sentry.replays.usecases.ingest import ProcessedRecordingMessage
from sentry.replays.usecases.ingest.event_parser import ParsedEventMeta
from tests.sentry.replays.unit.consumers.test_helpers import (
    MockCommit,
    MockRunTime,
    make_kafka_message,
)

RECORDINGS_CODEC = get_topic_codec(Topic.INGEST_REPLAYS_RECORDINGS)


def test_end_to_end_message_processing():
    """End to end test of the recording consumer."""
    runtime = _make_runtime()

    message: ReplayRecording = {
        "key_id": None,
        "org_id": 1,
        "payload": b'{"segment_id":0}\n[]',
        "project_id": 1,
        "received": int(time.time()),
        "replay_event": None,
        "replay_id": uuid.uuid4().hex,
        "replay_video": None,
        "retention_days": 30,
        "type": "replay_recording_not_chunked",
        "version": 1,
    }
    message_bytes = RECORDINGS_CODEC.encode(message)
    kafka_message = make_kafka_message(message_bytes)

    gen = runtime.submit(kafka_message)

    # Assert the runtime gets the current time after appending the message and then attempts to
    # flush the buffer with the current time.
    cmd = next(gen)
    assert isinstance(cmd, Effect)
    assert cmd.fun == time.time
    assert cmd.msg(1) == TryFlush(now=1)
    assert runtime.model.buffer == [
        ProcessedRecordingMessage(
            actions_event=ParsedEventMeta([], [], [], [], [], []),
            filedata=zlib.compress(b"[]"),
            filename=runtime.model.buffer[0].filename,
            is_replay_video=False,
            key_id=None,
            org_id=1,
            project_id=1,
            received=message["received"],
            recording_size_uncompressed=2,
            recording_size=runtime.model.buffer[0].recording_size,
            retention_days=30,
            replay_id=message["replay_id"],
            segment_id=0,
            video_size=None,
            replay_event=None,
        )
    ]

    # Give the runtime timestamps that are too early to flush (including the one the runtime wanted
    # to generate).
    assert isinstance(gen.send(TryFlush(now=1)), Nothing)
    assert isinstance(gen.send(TryFlush(now=2)), Nothing)
    assert isinstance(gen.send(TryFlush(now=3)), Nothing)
    assert isinstance(gen.send(cmd.msg(cmd.fun())), Nothing)

    # Give the runtime a timestamp that will trigger a flush.
    cmd = gen.send(TryFlush(now=time.time() + 1))
    assert isinstance(cmd, Task)
    assert isinstance(cmd.msg, Flush)

    # Assert the runtime triggered a buffer flush and forward the next msg to the runtime.
    cmd = gen.send(cmd.msg)
    assert isinstance(cmd, Effect)
    assert cmd.fun == FlushBuffer(runtime.model)
    assert len(runtime.model.buffer) == 1

    # Assert the successful flush triggers a commit command. Assert the model's offsets were
    # committed and the buffer was reset.
    cmd = gen.send(cmd.msg(1))
    assert len(runtime.model.buffer) == 0
    assert runtime.model.last_flushed_at == 1
    assert isinstance(cmd, Commit)
    assert isinstance(cmd.msg, Committed)
    assert cmd.offsets == runtime.model.offsets
    assert cmd.offsets == {Partition(topic=ArroyoTopic(name="a"), index=1): 2}


def test_invalid_message_format():
    """Test message with invalid message format."""
    runtime = _make_runtime()

    # We submit a message which can't be parsed and will not be buffered. Flush is not triggered.
    gen = runtime.submit(make_kafka_message(b"invalid"))
    cmd = next(gen)
    assert len(runtime.model.buffer) == 0
    assert len(runtime.model.offsets) == 1
    assert isinstance(cmd, Effect)
    assert cmd.fun == time.time
    assert isinstance(gen.send(cmd.msg(cmd.fun())), Nothing)

    # Trigger a flush by submitting a time that exceeds the window.
    cmd = gen.send(TryFlush(now=time.time() + 1))
    assert isinstance(cmd, Task)
    assert isinstance(cmd.msg, Flush)

    # Send the flush message the runtime provided and assert that it produces a FlushBuffer
    # effect.
    cmd = gen.send(cmd.msg)
    assert isinstance(cmd, Effect)
    assert cmd.fun == FlushBuffer(runtime.model)

    # Send the `Flushed` message with an arbitrary timestamp. Offsets are retained so the invalid
    # message is never revisited.
    cmd = gen.send(cmd.msg(1))
    assert runtime.model.last_flushed_at == 1
    assert len(runtime.model.buffer) == 0
    assert len(runtime.model.offsets) == 1  # offsets are retained


def test_invalid_recording_json():
    """Test message with invalid recording JSON."""
    runtime = _make_runtime()

    message: ReplayRecording = {
        "key_id": None,
        "org_id": 1,
        "payload": b'{"segment_id":0}\n[',
        "project_id": 1,
        "received": int(time.time()),
        "replay_event": None,
        "replay_id": uuid.uuid4().hex,
        "replay_video": None,
        "retention_days": 30,
        "type": "replay_recording_not_chunked",
        "version": 1,
    }
    message_bytes = RECORDINGS_CODEC.encode(message)
    kafka_message = make_kafka_message(message_bytes)

    # We submit a message which will not be buffered. Flush is not triggered.
    gen = runtime.submit(kafka_message)
    cmd = next(gen)
    assert len(runtime.model.buffer) == 1
    assert len(runtime.model.offsets) == 1
    assert isinstance(cmd, Effect)
    assert isinstance(gen.send(cmd.msg(cmd.fun())), Nothing)

    # Trigger a flush by submitting a time that exceeds the window.
    cmd = gen.send(TryFlush(now=time.time() + 1))
    assert isinstance(cmd, Task)
    assert isinstance(cmd.msg, Flush)

    # Send the flush message the runtime provided and assert that it produces a FlushBuffer
    # effect.
    cmd = gen.send(cmd.msg)
    assert isinstance(cmd, Effect)
    assert cmd.fun == FlushBuffer(runtime.model)

    # Send the `Flushed` message with an arbitrary timestamp. Offsets are retained so the invalid
    # message is never revisited.
    cmd = gen.send(cmd.msg(1))
    assert runtime.model.last_flushed_at == 1
    assert len(runtime.model.buffer) == 0
    assert len(runtime.model.offsets) == 1  # offsets are retained


def test_missing_headers():
    """Test message with missing headers."""
    runtime = _make_runtime()

    message: ReplayRecording = {
        "key_id": None,
        "org_id": 1,
        "payload": b"[]",
        "project_id": 1,
        "received": int(time.time()),
        "replay_event": None,
        "replay_id": uuid.uuid4().hex,
        "replay_video": None,
        "retention_days": 30,
        "type": "replay_recording_not_chunked",
        "version": 1,
    }
    message_bytes = RECORDINGS_CODEC.encode(message)
    kafka_message = make_kafka_message(message_bytes)

    # We submit a message which will not be buffered. Flush is not triggered.
    gen = runtime.submit(kafka_message)
    cmd = next(gen)
    assert len(runtime.model.buffer) == 0
    assert len(runtime.model.offsets) == 1
    assert isinstance(cmd, Effect)
    assert isinstance(gen.send(cmd.msg(cmd.fun())), Nothing)

    # Trigger a flush by submitting a time that exceeds the window.
    cmd = gen.send(TryFlush(now=time.time() + 1))
    assert isinstance(cmd, Task)
    assert isinstance(cmd.msg, Flush)

    # Send the flush message the runtime provided and assert that it produces a FlushBuffer
    # effect.
    cmd = gen.send(cmd.msg)
    assert isinstance(cmd, Effect)
    assert cmd.fun == FlushBuffer(runtime.model)

    # Send the `Flushed` message with an arbitrary timestamp. Offsets are retained so the invalid
    # message is never revisited.
    cmd = gen.send(cmd.msg(1))
    assert runtime.model.last_flushed_at == 1
    assert len(runtime.model.buffer) == 0
    assert len(runtime.model.offsets) == 1  # offsets are retained


def test_buffer_full_semantics():
    runtime = _make_runtime()

    message: ReplayRecording = {
        "key_id": None,
        "org_id": 1,
        "payload": b'{"segment_id":0}\n[]',
        "project_id": 1,
        "received": int(time.time()),
        "replay_event": None,
        "replay_id": uuid.uuid4().hex,
        "replay_video": None,
        "retention_days": 30,
        "type": "replay_recording_not_chunked",
        "version": 1,
    }
    message_bytes = RECORDINGS_CODEC.encode(message)
    kafka_message = make_kafka_message(message_bytes)

    # We submit a message which will be buffered but not flushed.
    gen = runtime.submit(kafka_message)
    cmd = next(gen)
    assert isinstance(cmd, Effect)
    assert cmd.fun == time.time

    # Assert the TryFlush msg produced by the runtime had no effect because the buffer was not full
    # and the wait interval was not exceeded.
    assert isinstance(gen.send(cmd.msg(cmd.fun())), Nothing)

    # We submit another message which will be buffered and trigger a flush.
    gen = runtime.submit(kafka_message)
    cmd = next(gen)
    assert isinstance(cmd, Effect)
    assert cmd.fun == time.time
    assert cmd.msg(1) == TryFlush(now=1)

    # Assert a flush command is triggered from the msg produced by the runtime.
    cmd = gen.send(cmd.msg(cmd.fun()))
    assert isinstance(cmd, Task)
    assert isinstance(cmd.msg, Flush)


def test_buffer_timeout():
    runtime = _make_runtime()

    message: ReplayRecording = {
        "key_id": None,
        "org_id": 1,
        "payload": b'{"segment_id":0}\n[]',
        "project_id": 1,
        "received": int(time.time()),
        "replay_event": None,
        "replay_id": uuid.uuid4().hex,
        "replay_video": None,
        "retention_days": 30,
        "type": "replay_recording_not_chunked",
        "version": 1,
    }
    message_bytes = RECORDINGS_CODEC.encode(message)
    kafka_message = make_kafka_message(message_bytes)

    # We submit a message which will be buffered but not flushed.
    gen = runtime.submit(kafka_message)
    cmd = next(gen)
    assert isinstance(cmd, Effect)
    assert cmd.fun == time.time
    assert cmd.msg(1) == TryFlush(now=1)

    # Assert the TryFlush msg produced by the runtime had no effect because the wait interval was
    # not exceeded.
    assert isinstance(gen.send(cmd.msg(cmd.fun())), Nothing)

    # Now we emit a new TryFlush message with a timestamp in the future. This triggers the runtime
    # to flush because its flush interval has been exceeded.
    cmd = gen.send(TryFlush(now=time.time() + 1))
    assert isinstance(cmd, Task)
    assert isinstance(cmd.msg, Flush)


def _make_runtime():
    runtime = MockRunTime(init, process, subscription, update)
    runtime.setup(
        {
            "max_buffer_length": 2,
            "max_buffer_wait": 1,
            "max_workers": 1,
        },
        MockCommit(),
    )
    return runtime
