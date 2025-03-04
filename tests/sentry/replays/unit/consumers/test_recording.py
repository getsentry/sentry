import time
import uuid
import zlib

from sentry_kafka_schemas.schema_types.ingest_replay_recordings_v1 import ReplayRecording

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.replays.consumers.buffered.consumer import (
    Append,
    Committed,
    Flush,
    FlushBuffer,
    Skip,
    TryFlush,
    init,
    process,
    subscription,
    update,
)
from sentry.replays.consumers.buffered.platform import Commit, Effect, Nothing, Task
from sentry.replays.usecases.ingest import ProcessedRecordingMessage
from sentry.replays.usecases.ingest.event_parser import ParsedEventMeta
from tests.sentry.replays.unit.consumers.test_helpers import MockNextStep, SandboxRunTime

RECORDINGS_CODEC = get_topic_codec(Topic.INGEST_REPLAYS_RECORDINGS)


def test_end_to_end_message_processing():
    """End to end test of the recording consumer."""
    runtime = _make_runtime()

    message: ReplayRecording = {
        "key_id": None,
        "org_id": 1,
        "payload": b'{"segment_id":0}\n[]',  # type: ignore[typeddict-item]
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

    gen = runtime.submit(message_bytes)

    # Assert the application does not append the message to the buffer.
    msg = next(gen)
    assert isinstance(msg, Append)

    # Assert the application gets the current time after appending the message and then attempts to
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

    # Give the application timestamps that are too early to flush (including the one the
    # application wanted to generate).
    assert isinstance(gen.send(TryFlush(now=1)), Nothing)
    assert isinstance(gen.send(TryFlush(now=2)), Nothing)
    assert isinstance(gen.send(TryFlush(now=3)), Nothing)
    assert cmd.msg(1) == TryFlush(now=1)
    assert isinstance(gen.send(cmd.msg(cmd.fun())), Nothing)

    # Give the application a timestamp that will trigger a flush.
    cmd = gen.send(TryFlush(now=time.time() + 1))
    assert isinstance(cmd, Task)
    assert isinstance(cmd.msg, Flush)

    # Assert the application triggered a buffer flush and forward the next msg to the application.
    cmd = gen.send(cmd.msg)
    assert isinstance(cmd, Effect)
    assert cmd.fun == FlushBuffer(runtime.model)
    assert len(runtime.model.buffer) == 1

    # Assert the successful flush triggers a commit command.
    cmd = gen.send(cmd.msg(1))
    assert len(runtime.model.buffer) == 0
    assert runtime.model.last_flushed_at == 1
    assert isinstance(cmd, Commit)
    assert isinstance(cmd.msg, Committed)


def test_invalid_message_format():
    """Test message with invalid message format."""
    runtime = _make_runtime()

    # We submit a message which can't be parsed and will not be buffered. Flush is not triggered.
    gen = runtime.submit(b"invalid")

    # Assert the application does not append the message to the buffer.
    msg = next(gen)
    assert isinstance(msg, Skip)

    # Application tries to flush.
    cmd = next(gen)
    assert len(runtime.model.buffer) == 0
    assert isinstance(cmd, Effect)
    assert cmd.fun == time.time
    assert cmd.msg(1) == TryFlush(now=1)
    assert isinstance(gen.send(cmd.msg(cmd.fun())), Nothing)


def test_invalid_recording_json():
    """Test message with invalid recording JSON."""
    runtime = _make_runtime()

    message: ReplayRecording = {
        "key_id": None,
        "org_id": 1,
        "payload": b'{"segment_id":0}\n[',  # type: ignore[typeddict-item]
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

    gen = runtime.submit(message_bytes)

    # Assert the application appends the message to the buffer.
    msg = next(gen)
    assert isinstance(msg, Append)

    # Application tries to flush.
    cmd = next(gen)
    assert len(runtime.model.buffer) == 1
    assert isinstance(cmd, Effect)
    assert cmd.msg(1) == TryFlush(now=1)
    assert isinstance(gen.send(cmd.msg(cmd.fun())), Nothing)


def test_missing_headers():
    """Test message with missing headers."""
    runtime = _make_runtime()

    message: ReplayRecording = {
        "key_id": None,
        "org_id": 1,
        "payload": b"[]",  # type: ignore[typeddict-item]
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

    gen = runtime.submit(message_bytes)

    # Assert the application does not append the message to the buffer.
    msg = next(gen)
    assert isinstance(msg, Skip)

    # Application tries to flush.
    cmd = next(gen)
    assert len(runtime.model.buffer) == 0
    assert isinstance(cmd, Effect)
    assert cmd.msg(1) == TryFlush(now=1)
    assert isinstance(gen.send(cmd.msg(cmd.fun())), Nothing)


def test_buffer_full_semantics():
    runtime = _make_runtime()

    message: ReplayRecording = {
        "key_id": None,
        "org_id": 1,
        "payload": b'{"segment_id":0}\n[]',  # type: ignore[typeddict-item]
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

    gen = runtime.submit(message_bytes)

    # Assert the application appends the message to the buffer.
    msg = next(gen)
    assert isinstance(msg, Append)

    # Application tries to flush.
    cmd = next(gen)
    assert isinstance(cmd, Effect)
    assert cmd.fun == time.time

    # Assert the TryFlush msg produced by the runtime had no effect because the buffer was not full
    # and the wait interval was not exceeded.
    assert isinstance(gen.send(cmd.msg(cmd.fun())), Nothing)

    # We submit another message which will be buffered and trigger a flush.
    gen = runtime.submit(message_bytes)

    # Assert the application appends the message to the buffer.
    msg = next(gen)
    assert isinstance(msg, Append)

    # Application tries to flush.
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
        "payload": b'{"segment_id":0}\n[]',  # type: ignore[typeddict-item]
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

    gen = runtime.submit(message_bytes)

    # Assert the application does not append the message to the buffer.
    msg = next(gen)
    assert isinstance(msg, Append)

    # Application tries to flush.
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
    runtime = SandboxRunTime(init, process, subscription, update)
    runtime.setup(
        {
            "max_buffer_length": 2,
            "max_buffer_wait": 1,
            "max_workers": 1,
        },
        MockNextStep(),
    )
    return runtime
