from __future__ import absolute_import

import logging
import threading
from collections import defaultdict, namedtuple


logger = logging.getLogger(__name__)


Offsets = namedtuple("Offsets", "local remote")


class InvalidState(Exception):
    pass


class InvalidStateTransition(Exception):
    pass


class MessageNotReady(Exception):
    pass


class SynchronizedPartitionState:
    # The ``SYNCHRONIZED`` state represents that the local offset is equal to
    # the remote offset. The local consumer should be paused to avoid advancing
    # further beyond the remote consumer.
    SYNCHRONIZED = "SYNCHRONIZED"

    # The ``LOCAL_BEHIND`` state represents that the remote offset is greater
    # than the local offset. The local consumer should be unpaused to avoid
    # falling behind the remote consumer.
    LOCAL_BEHIND = "LOCAL_BEHIND"

    # The ``REMOTE_BEHIND`` state represents that the local offset is greater
    # than the remote offset. The local consumer should be paused to avoid
    # advancing further beyond the remote consumer.
    REMOTE_BEHIND = "REMOTE_BEHIND"

    # The ``UNKNOWN`` state represents that we haven't received enough data to
    # know the current offset state.
    UNKNOWN = "UNKNOWN"


class SynchronizedPartitionStateManager(object):
    """
    This class implements a state machine that can be used to track the
    consumption progress of a Kafka partition (the "local" consumer) relative
    to a the progress of another consumer (the "remote" consumer.)

    This is intended to be paired with the ``SynchronizedConsumer``.
    """

    transitions = {  # from state -> set(to states)
        None: frozenset([SynchronizedPartitionState.UNKNOWN]),
        SynchronizedPartitionState.UNKNOWN: frozenset(
            [
                SynchronizedPartitionState.LOCAL_BEHIND,
                SynchronizedPartitionState.REMOTE_BEHIND,
                SynchronizedPartitionState.SYNCHRONIZED,
            ]
        ),
        SynchronizedPartitionState.REMOTE_BEHIND: frozenset(
            [SynchronizedPartitionState.LOCAL_BEHIND, SynchronizedPartitionState.SYNCHRONIZED]
        ),
        SynchronizedPartitionState.LOCAL_BEHIND: frozenset(
            [SynchronizedPartitionState.SYNCHRONIZED, SynchronizedPartitionState.REMOTE_BEHIND]
        ),
        SynchronizedPartitionState.SYNCHRONIZED: frozenset(
            [SynchronizedPartitionState.LOCAL_BEHIND, SynchronizedPartitionState.REMOTE_BEHIND]
        ),
    }

    def __init__(self, callback):
        self.partitions = defaultdict(lambda: (None, Offsets(None, None)))
        self.callback = callback
        self.__lock = threading.RLock()

    def get_state_from_offsets(self, offsets):
        """
        Derive the partition state by comparing local and remote offsets.
        """
        if offsets.local is None or offsets.remote is None:
            return SynchronizedPartitionState.UNKNOWN
        else:
            if offsets.local < offsets.remote:
                return SynchronizedPartitionState.LOCAL_BEHIND
            elif offsets.remote < offsets.local:
                return SynchronizedPartitionState.REMOTE_BEHIND
            else:  # local == remote
                return SynchronizedPartitionState.SYNCHRONIZED

    def set_local_offset(self, topic, partition, local_offset):
        """
        Update the local offset for a topic and partition.

        If this update operation results in a state change, the callback
        function will be invoked.
        """
        with self.__lock:
            previous_state, previous_offsets = self.partitions[(topic, partition)]
            if previous_offsets.local is not None and (
                local_offset is None or local_offset < previous_offsets.local
            ):
                logger.info(
                    "Local offset for %s/%s has moved backwards (current: %s, previous: %s)",
                    topic,
                    partition,
                    local_offset,
                    previous_offsets.local,
                )
            updated_offsets = Offsets(local_offset, previous_offsets.remote)
            updated_state = self.get_state_from_offsets(updated_offsets)
            if (
                previous_state is not updated_state
                and updated_state not in self.transitions[previous_state]
            ):
                raise InvalidStateTransition(
                    u"Unexpected state transition for {}/{} from {} to {}".format(
                        topic, partition, previous_state, updated_state
                    )
                )
            self.partitions[(topic, partition)] = (updated_state, updated_offsets)
            if previous_state is not updated_state:
                if updated_state == SynchronizedPartitionState.REMOTE_BEHIND:
                    logger.warning(
                        "Current local offset for %s/%s (%s) exceeds remote offset (%s)!",
                        topic,
                        partition,
                        updated_offsets.local,
                        updated_offsets.remote,
                    )
                self.callback(
                    topic,
                    partition,
                    (previous_state, previous_offsets),
                    (updated_state, updated_offsets),
                )

    def set_remote_offset(self, topic, partition, remote_offset):
        """
        Update the remote offset for a topic and partition.

        If this update operation results in a state change, the callback
        function will be invoked.
        """
        with self.__lock:
            previous_state, previous_offsets = self.partitions[(topic, partition)]
            if previous_offsets.remote is not None and (
                remote_offset is None or remote_offset < previous_offsets.remote
            ):
                logger.info(
                    "Remote offset for %s/%s has moved backwards (current: %s, previous: %s)",
                    topic,
                    partition,
                    remote_offset,
                    previous_offsets.remote,
                )
            updated_offsets = Offsets(previous_offsets.local, remote_offset)
            updated_state = self.get_state_from_offsets(updated_offsets)
            if (
                previous_state is not updated_state
                and updated_state not in self.transitions[previous_state]
            ):
                raise InvalidStateTransition(
                    u"Unexpected state transition for {}/{} from {} to {}".format(
                        topic, partition, previous_state, updated_state
                    )
                )
            self.partitions[(topic, partition)] = (updated_state, updated_offsets)
            if previous_state is not updated_state:
                self.callback(
                    topic,
                    partition,
                    (previous_state, previous_offsets),
                    (updated_state, updated_offsets),
                )

    def validate_local_message(self, topic, partition, offset):
        """
        Check if a message should be consumed by the local consumer.

        The local consumer should be prevented from consuming messages that
        have yet to have been committed by the remote consumer.
        """
        with self.__lock:
            state, offsets = self.partitions[(topic, partition)]
            if state is not SynchronizedPartitionState.LOCAL_BEHIND:
                raise InvalidState(
                    "Received a message while consumer is not in LOCAL_BEHIND state!"
                )
            if offset >= offsets.remote:
                raise MessageNotReady(
                    "Received a message that has not been committed by remote consumer"
                )
            if offset < offsets.local:
                logger.warning(
                    "Received a message prior to local offset (local consumer offset rewound without update?)"
                )
