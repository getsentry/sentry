import functools
import logging
from collections.abc import Mapping
from concurrent.futures import ThreadPoolExecutor
from typing import Literal

import orjson
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
)
from arroyo.processing.strategies.batching import BatchStep, ValuesBatch
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import Commit, Message, Partition

from sentry.utils.arroyo import MultiprocessingPool, run_task_with_multiprocessing

logger = logging.getLogger(__name__)


class OccurrenceStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        max_batch_size: int,
        max_batch_time: int,
        # not needed in batched-parallel mode
        num_processes: int | None = None,
        input_block_size: int | None = None,
        output_block_size: int | None = None,
        mode: Literal["batched-parallel", "parallel"] | None = None,
    ):
        super().__init__()
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.input_block_size = input_block_size
        self.output_block_size = output_block_size

        self.batched = mode == "batched-parallel"
        # either use multi-process pool or a thread pool
        if self.batched:
            self.worker: ThreadPoolExecutor | None = ThreadPoolExecutor()
            self.pool: MultiprocessingPool | None = None
        else:
            # make sure num_processes is not None
            assert num_processes is not None
            self.pool = MultiprocessingPool(num_processes)
            self.worker = None

    def create_parallel_worker(
        self,
        commit: Commit,
    ) -> ProcessingStrategy[KafkaPayload]:
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

    def create_batched_parallel_worker(self, commit: Commit) -> ProcessingStrategy[KafkaPayload]:
        assert self.worker is not None
        batch_processor = RunTask(
            function=functools.partial(process_batch, self.worker),
            next_step=CommitOffsets(commit),
        )
        return BatchStep(
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            next_step=batch_processor,
        )

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        if self.batched:
            return self.create_batched_parallel_worker(commit)
        else:
            return self.create_parallel_worker(commit)

    def shutdown(self) -> None:
        if self.pool:
            self.pool.close()
        if self.worker:
            self.worker.shutdown()


def process_message(message: Message[KafkaPayload]) -> None:
    from sentry.issues.occurrence_consumer import _process_message

    try:
        payload = orjson.loads(message.payload.value)
        _process_message(payload)
    except Exception:
        logger.exception("failed to process message payload")


def process_batch(worker: ThreadPoolExecutor, messages: Message[ValuesBatch[KafkaPayload]]) -> None:
    from sentry.issues.occurrence_consumer import process_occurrence_batch

    try:
        process_occurrence_batch(worker, messages)
    except Exception:
        logger.exception("failed to process batch payload")
