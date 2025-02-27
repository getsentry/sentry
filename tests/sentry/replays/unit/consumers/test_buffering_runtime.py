import pytest
from arroyo.types import Partition, Topic

from sentry.replays.consumers.buffered.lib import Model, buffering_runtime
from tests.sentry.replays.unit.consumers.test_helpers import (
    MockCommit,
    MockSink,
    make_kafka_message,
)


def buffer_runtime(sink):
    return buffering_runtime(
        init_fn=lambda _: Model(
            # The buffer is an arbitrary list of items but it could be anything. For example a
            # string which you could perpetually append to.
            buffer=[],
            # Commit when the buffer has 5 messages in it.
            can_flush=lambda m: len(m.buffer) == 5,
            # Flush in this case is just pushing the buffer into a mock class which holds the
            # messages in memory. This is easy for us to test and we don't need to mock out any
            # service code which is both unknown to the RunTime and can be tested independently.
            do_flush=lambda m: sink.accept(m.buffer),
            # This is the offsets tracking object. The RunTime manages appending.
            offsets={},
        ),
        # Our process function is a simple lambda which checks that the message is a valid
        # integer and is less than 5. There's no exception handling here. That could crash the
        # consumer! Its up to the application developer to manage.
        process_fn=lambda m: int(m) if int(m) < 5 else None,
    )


def test_runtime_setup():
    """Test RunTime initialization."""
    runtime = buffer_runtime(MockSink())
    runtime.setup({}, commit=MockCommit())
    assert runtime.model.buffer == []
    assert runtime.model.offsets == {}


def test_buffering_runtime_submit():
    """Test message recived from the platform.

    Messages are buffered up until a point (see the RunTime definition at the top of the module).
    When we cross the threshold the RunTime should order a buffer flush action.
    """
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


def test_buffering_runtime_submit_invalid_message():
    """Test invalid message recived from the platform."""
    mock_commit = MockCommit()
    sink = MockSink()

    runtime = buffer_runtime(sink)
    runtime.setup({}, mock_commit)
    assert runtime.model.buffer == []
    assert runtime.model.offsets == {}
    assert sink.accepted == []
    assert mock_commit.commit == {}

    # Assert exceptional behavior is not handled.
    with pytest.raises(ValueError):
        runtime.submit(make_kafka_message(b"hello"))


def test_buffering_runtime_join():
    """Test the RunTime received a join message from the platform.

    When the consumer is ordered to shutdown a "join" message will be submitted to the RunTime.
    When that happens we rush to flush the buffer and commit whatever we can.
    """
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


def test_buffering_runtime_poll():
    """Test the RunTime received a poll message from the platform.

    This will happen periodically. In the event the consumer does not receive messages for some
    interval the poll message will be published will be called.
    """
    mock_commit = MockCommit()
    sink = MockSink()

    runtime = buffer_runtime(sink)
    runtime.setup({}, mock_commit)
    assert runtime.model.buffer == []
    assert runtime.model.offsets == {}
    assert sink.accepted == []
    assert mock_commit.commit == {}

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
