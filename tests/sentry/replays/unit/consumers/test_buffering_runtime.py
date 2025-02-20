from arroyo.types import Partition, Topic

from sentry.replays.consumers.buffered.lib import Model, buffering_runtime
from tests.sentry.replays.unit.consumers.helpers import MockCommit, MockSink, make_kafka_message


def buffer_runtime(sink):
    return buffering_runtime(
        init_fn=lambda _: Model(
            buffer=[],
            can_flush=lambda m: len(m.buffer) == 5,
            do_flush=lambda m: sink.accept(m.buffer),
            offsets={},
        ),
        process_fn=lambda m: int(m) if int(m) < 5 else None,
    )


def test_runtime_setup():
    runtime = buffer_runtime(MockSink())
    runtime.setup({}, commit=MockCommit())
    assert runtime.model.buffer == []
    assert runtime.model.offsets == {}


def test_buffering_runtime_submit():
    mock_commit = MockCommit()
    sink = MockSink()

    runtime = buffer_runtime(sink)
    runtime.setup({}, mock_commit)
    assert runtime.model.buffer == []
    assert runtime.model.offsets == {}
    assert sink.accepted == []
    assert mock_commit.commit == {}

    # Assert three valid messages buffered.
    runtime.submit(make_kafka_message(b"1"))
    runtime.submit(make_kafka_message(b"1"))
    runtime.submit(make_kafka_message(b"1"))
    assert runtime.model.buffer == [1, 1, 1]
    assert sink.accepted == []
    assert mock_commit.commit == {}

    # Assert two invalid messages not buffered.
    runtime.submit(make_kafka_message(b"5"))
    runtime.submit(make_kafka_message(b"5"))
    assert runtime.model.buffer == [1, 1, 1]
    assert sink.accepted == []
    assert mock_commit.commit == {}

    # Assert an additional message is buffered.
    runtime.submit(make_kafka_message(b"2"))
    assert runtime.model.buffer == [1, 1, 1, 2]
    assert sink.accepted == []
    assert mock_commit.commit == {}

    # Assert the buffer is flushed to the sink.
    runtime.submit(make_kafka_message(b"3"))
    assert runtime.model.buffer == []
    assert sink.accepted == [1, 1, 1, 2, 3]
    assert mock_commit.commit == {Partition(Topic("a"), 1): 2}


def test_buffering_runtime_publish():
    mock_commit = MockCommit()
    sink = MockSink()

    runtime = buffer_runtime(sink)
    runtime.setup({}, mock_commit)
    assert runtime.model.buffer == []
    assert runtime.model.offsets == {}
    assert sink.accepted == []

    # Assert three valid messages buffered.
    runtime.submit(make_kafka_message(b"1"))
    runtime.submit(make_kafka_message(b"1"))
    runtime.submit(make_kafka_message(b"1"))
    assert runtime.model.buffer == [1, 1, 1]
    assert sink.accepted == []

    # Assert join subscriptions eagerly flush the buffer.
    runtime.publish("join")
    assert runtime.model.buffer == []
    assert sink.accepted == [1, 1, 1]
    assert mock_commit.commit == {Partition(Topic("a"), 1): 2}

    # Reset the mocks.
    mock_commit.commit = {}
    sink.accepted = []

    # Assert poll does not automatically empty the buffer.
    runtime.submit(make_kafka_message(b"1"))
    runtime.publish("poll")
    assert runtime.model.buffer == [1]
    assert sink.accepted == []

    # Dirty mutation warning! We're forcing ourselves to be in a flushable state by mutating the
    # state outside the explicit state machine interfaces.
    runtime.model.buffer = [1, 2, 3, 4, 5]
    assert runtime.model.buffer == [1, 2, 3, 4, 5]
    assert sink.accepted == []

    # Assert poll flushes if the buffer is ready.
    runtime.publish("poll")
    assert runtime.model.buffer == []
    assert sink.accepted == [1, 2, 3, 4, 5]
    assert mock_commit.commit == {Partition(Topic("a"), 1): 2}
