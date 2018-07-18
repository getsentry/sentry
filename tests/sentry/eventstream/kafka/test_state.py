import pytest
import mock
from sentry.eventstream.kafka.state import (
    InvalidState,
    InvalidStateTransition,
    MessageNotReady,
    Offsets,
    PartitionState,
    SynchronizedPartitionStateManager,
)


def test_transitions():
    callback = mock.MagicMock()
    state = SynchronizedPartitionStateManager(callback)

    with pytest.raises(InvalidState):
        state.validate_local_message('topic', 0, 0)

    state.set_local_offset('topic', 0, 1)
    assert callback.mock_calls[-1] == mock.call(
        'topic', 0,
        (None, Offsets(None, None)),
        (PartitionState.UNKNOWN, Offsets(1, None)),
    )

    with pytest.raises(InvalidState):
        state.validate_local_message('topic', 0, 0)

    state.set_remote_offset('topic', 0, 1)
    assert callback.mock_calls[-1] == mock.call(
        'topic', 0,
        (PartitionState.UNKNOWN, Offsets(1, None)),
        (PartitionState.SYNCHRONIZED, Offsets(1, 1)),
    )

    with pytest.raises(InvalidStateTransition):
        state.set_local_offset('topic', 0, None)

    with pytest.raises(InvalidStateTransition):
        state.set_remote_offset('topic', 0, None)

    state.set_remote_offset('topic', 0, 2)
    assert callback.mock_calls[-1] == mock.call(
        'topic', 0,
        (PartitionState.SYNCHRONIZED, Offsets(1, 1)),
        (PartitionState.LOCAL_BEHIND, Offsets(1, 2)),
    )

    state.validate_local_message('topic', 0, 1)

    with pytest.raises(MessageNotReady):
        state.validate_local_message('topic', 0, 2)

    state.set_local_offset('topic', 0, 2)
    assert callback.mock_calls[-1] == mock.call(
        'topic', 0,
        (PartitionState.LOCAL_BEHIND, Offsets(1, 2)),
        (PartitionState.SYNCHRONIZED, Offsets(2, 2)),
    )

    state.set_remote_offset('topic', 1, 5)
    assert callback.mock_calls[-1] == mock.call(
        'topic', 1,
        (None, Offsets(None, None)),
        (PartitionState.UNKNOWN, Offsets(None, 5)),
    )

    state.set_local_offset('topic', 1, 0)
    assert callback.mock_calls[-1] == mock.call(
        'topic', 1,
        (PartitionState.UNKNOWN, Offsets(None, 5)),
        (PartitionState.LOCAL_BEHIND, Offsets(0, 5)),
    )

    before_calls = len(callback.mock_calls)
    state.set_local_offset('topic', 1, 1)
    state.set_local_offset('topic', 1, 2)
    state.set_local_offset('topic', 1, 3)
    state.set_local_offset('topic', 1, 4)
    assert len(callback.mock_calls) == before_calls

    state.set_local_offset('topic', 1, 5)
    assert callback.mock_calls[-1] == mock.call(
        'topic', 1,
        (PartitionState.LOCAL_BEHIND, Offsets(4, 5)),
        (PartitionState.SYNCHRONIZED, Offsets(5, 5)),
    )
