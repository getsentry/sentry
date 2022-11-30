from __future__ import annotations

import logging
import random
from typing import Callable, Mapping

import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.transform import ParallelTransformStep
from arroyo.types import Message, Partition, Position
from django.conf import settings

from sentry.replays.usecases.ingest import ingest_recording_not_chunked

logger = logging.getLogger("sentry.replays")

COMMIT_FREQUENCY_SEC = 1


class RecordingProcessorStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        parallel_strategy = ParallelTransformStep(
            run,
            CommitOffsets(commit),
            num_processes=4,  # 4 workers.
            max_batch_size=100,  # Maximum number of messages than can be processed before commit.
            max_batch_time=1,  # Maximum number of seconds before commit.
            input_block_size=1024 * 1024,  # (??), 1MB
            output_block_size=1024 * 1024,  # (??), 1MB
            initializer=None,  # Do we need to initialize sentry?  `from sentry.runner import configure`
        )
        return parallel_strategy


def run(message: Message[KafkaPayload]) -> None:
    transaction = sentry_sdk.start_transaction(
        name="replays.consumers.strategies.recording",
        op="run",
        sampled=random.random()
        < getattr(settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0),
    )

    try:
        ingest_recording_not_chunked(message.payload.value, transaction)
    except Exception:
        logger.exception("Failed to process message", extra={"offset": message.offset})
        transaction.finish()


# Remove after deps update


from typing import Optional

from arroyo.types import Commit, TPayload


class CommitOffsets(ProcessingStrategy[TPayload]):
    """
    Just commits offsets.

    This should always be used as the last step in a chain of processing
    strategies. It commits offsets back to the broker after all prior
    processing of that message is completed.
    """

    def __init__(self, commit: Commit) -> None:
        self.__commit = commit

    def poll(self) -> None:
        pass

    def submit(self, message: Message[TPayload]) -> None:
        self.__commit(message.committable)

    def close(self) -> None:
        pass

    def terminate(self) -> None:
        pass

    def join(self, timeout: Optional[float] = None) -> None:
        # Commit all previously staged offsets
        self.__commit({}, force=True)
