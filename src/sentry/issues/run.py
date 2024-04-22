import logging
from collections.abc import Mapping
from typing import Literal

from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
)
from arroyo.processing.strategies.batching import BatchStep
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import Commit, Message, Partition

from sentry.utils.arroyo import MultiprocessingPool, RunTaskWithMultiprocessing

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
        if num_processes is not None:
            self.pool = MultiprocessingPool(num_processes)
        self.batched = mode == "batched-parallel"

    def crate_parallel_worker(
        self,
        commit: Commit,
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTaskWithMultiprocessing(
            function=process_message,
            next_step=CommitOffsets(commit),
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            pool=self.pool,
            input_block_size=self.input_block_size,
            output_block_size=self.output_block_size,
        )

    def creat_batched_parallel_worker(self, commit: Commit) -> ProcessingStrategy[KafkaPayload]:
        batch_processor = RunTask(
            function=process_batch,
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
            return self.creat_batched_parallel_worker(commit)
        else:
            return self.crate_parallel_worker(commit)

    def shutdown(self) -> None:
        if self.pool:
            self.pool.close()


def process_message(message: Message[KafkaPayload]) -> None:
    from sentry.issues.occurrence_consumer import _process_message
    from sentry.utils import json, metrics

    try:
        with metrics.timer("occurrence_consumer.process_message"):
            payload = json.loads(message.payload.value, use_rapid_json=True)
            _process_message(payload)
    except Exception:
        logger.exception("failed to process message payload")


def process_batch(messages: list[Message[KafkaPayload]]) -> None:
    from sentry.issues.occurrence_consumer import _process_batch
    from sentry.utils import metrics

    try:
        with metrics.timer("occurrence_consumer.process_batch"):
            _process_batch(messages)
    except Exception:
        logger.exception("failed to process batch payload")
