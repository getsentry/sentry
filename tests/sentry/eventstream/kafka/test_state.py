from __future__ import absolute_import

import pytest
from sentry.utils.compat import mock
from sentry.eventstream.kafka.state import (
    InvalidState,
    InvalidStateTransition,
    MessageNotReady,
    Offsets,
    SynchronizedPartitionState,
    SynchronizedPartitionStateManager,
)


def test_transitions():
    callback = mock.MagicMock()
    state = SynchronizedPartitionStateManager(callback)

    with pytest.raises(InvalidState):
        state.validate_local_message("topic", 0, 0)

    state.set_local_offset("topic", 0, 1)
    assert callback.mock_calls[-1] == mock.call(
        "topic",
        0,
        (None, Offsets(None, None)),
        (SynchronizedPartitionState.UNKNOWN, Offsets(1, None)),
    )

    with pytest.raises(InvalidState):
        state.validate_local_message("topic", 0, 0)

    state.set_remote_offset("topic", 0, 1)
    assert callback.mock_calls[-1] == mock.call(
        "topic",
        0,
        (SynchronizedPartitionState.UNKNOWN, Offsets(1, None)),
        (SynchronizedPartitionState.SYNCHRONIZED, Offsets(1, 1)),
    )

    with pytest.raises(InvalidStateTransition):
        state.set_local_offset("topic", 0, None)

    with pytest.raises(InvalidStateTransition):
        state.set_remote_offset("topic", 0, None)

    state.set_remote_offset("topic", 0, 2)
    assert callback.mock_calls[-1] == mock.call(
        "topic",
        0,
        (SynchronizedPartitionState.SYNCHRONIZED, Offsets(1, 1)),
        (SynchronizedPartitionState.LOCAL_BEHIND, Offsets(1, 2)),
    )

    state.validate_local_message("topic", 0, 1)

    with pytest.raises(MessageNotReady):
        state.validate_local_message("topic", 0, 2)

    state.set_local_offset("topic", 0, 2)
    assert callback.mock_calls[-1] == mock.call(
        "topic",
        0,
        (SynchronizedPartitionState.LOCAL_BEHIND, Offsets(1, 2)),
        (SynchronizedPartitionState.SYNCHRONIZED, Offsets(2, 2)),
    )

    state.set_remote_offset("topic", 1, 5)
    assert callback.mock_calls[-1] == mock.call(
        "topic",
        1,
        (None, Offsets(None, None)),
        (SynchronizedPartitionState.UNKNOWN, Offsets(None, 5)),
    )

    state.set_local_offset("topic", 1, 0)
    assert callback.mock_calls[-1] == mock.call(
        "topic",
        1,
        (SynchronizedPartitionState.UNKNOWN, Offsets(None, 5)),
        (SynchronizedPartitionState.LOCAL_BEHIND, Offsets(0, 5)),
    )

    before_calls = len(callback.mock_calls)
    state.set_local_offset("topic", 1, 1)
    state.set_local_offset("topic", 1, 2)
    state.set_local_offset("topic", 1, 3)
    state.set_local_offset("topic", 1, 4)
    assert len(callback.mock_calls) == before_calls

    state.set_local_offset("topic", 1, 5)
    assert callback.mock_calls[-1] == mock.call(
        "topic",
        1,
        (SynchronizedPartitionState.LOCAL_BEHIND, Offsets(4, 5)),
        (SynchronizedPartitionState.SYNCHRONIZED, Offsets(5, 5)),
    )

    state.set_local_offset("topic", 1, 6)
    assert callback.mock_calls[-1] == mock.call(
        "topic",
        1,
        (SynchronizedPartitionState.SYNCHRONIZED, Offsets(5, 5)),
        (SynchronizedPartitionState.REMOTE_BEHIND, Offsets(6, 5)),
    )
