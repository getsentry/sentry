import dataclasses
from collections.abc import Mapping
from typing import Any

import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import RunTask, RunTaskInThreads
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import Commit, Message, Partition
from sentry_sdk.tracing import Span

from sentry.replays.usecases.ingest import ingest_recording
from sentry.utils.arroyo import MultiprocessingPool, run_task_with_multiprocessing


@dataclasses.dataclass
class MessageContext:
    message: bytes
    transaction: Span
    isolation_scope: sentry_sdk.Scope

    # The message attribute can cause large log messages to be emitted which can pin the CPU
    # to 100.
    def __repr__(self) -> str:
        return f"MessageContext(message_dict=..., transaction={repr(self.transaction)})"


class ProcessReplayRecordingStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    """
    This consumer processes replay recordings, which are compressed payloads split up into
    chunks.
    """

    def __init__(
        self,
        input_block_size: int | None,
        max_batch_size: int,
        max_batch_time: int,
        num_processes: int,
        output_block_size: int | None,
        num_threads: int = 4,  # Defaults to 4 for self-hosted.
        force_synchronous: bool = False,  # Force synchronous runner (only used in test suite).
    ) -> None:
        # For information on configuring this consumer refer to this page:
        #   https://getsentry.github.io/arroyo/strategies/run_task_with_multiprocessing.html
        self.input_block_size = input_block_size
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.num_processes = num_processes
        self.num_threads = num_threads
        self.output_block_size = output_block_size
        self.use_processes = self.num_processes > 1
        self.force_synchronous = force_synchronous
        self.pool = MultiprocessingPool(num_processes) if self.use_processes else None

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        if self.force_synchronous:
            return RunTask(
                function=process_message,
                next_step=CommitOffsets(commit),
            )
        elif self.use_processes:
            assert self.pool is not None
            return run_task_with_multiprocessing(
                function=process_message,
                next_step=CommitOffsets(commit),
                max_batch_size=self.max_batch_size,
                max_batch_time=self.max_batch_time,
                pool=self.pool,
                input_block_size=self.input_block_size,
                output_block_size=self.output_block_size,
            )
        else:
            # By default we preserve the previous behavior.
            return RunTaskInThreads(
                processing_function=process_message,
                concurrency=self.num_threads,
                max_pending_futures=50,
                next_step=CommitOffsets(commit),
            )

    def shutdown(self) -> None:
        if self.pool:
            self.pool.close()


def process_message(message: Message[KafkaPayload]) -> Any:
    """Move the replay payload to permanent storage."""
    ingest_recording(message.payload.value)
