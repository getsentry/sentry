import logging
from abc import ABC, abstractmethod
from typing import Mapping

from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
    RunTaskInThreads,
)
from arroyo.types import Commit, Message, Partition

from sentry.utils.arroyo import RunTaskWithMultiprocessing

logger = logging.getLogger(__name__)


class PostProcessForwarderStrategyFactory(ProcessingStrategyFactory[KafkaPayload], ABC):
    @abstractmethod
    def _dispatch_function(self, message: Message[KafkaPayload]) -> None:
        raise NotImplementedError()

    def __init__(
        self,
        mode: str,
        num_processes: int,
        input_block_size: int,
        output_block_size: int,
        max_batch_size: int,
        max_batch_time: int,
        concurrency: int,
    ) -> None:
        self.mode = mode
        self.num_processes = num_processes
        self.input_block_size = input_block_size
        self.output_block_size = output_block_size
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.concurrency = concurrency
        self.max_pending_futures = concurrency + 1000

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        if self.mode == "multithreaded":
            logger.info("Starting multithreaded post process forwarder")
            return RunTaskInThreads(
                processing_function=self._dispatch_function,
                concurrency=self.concurrency,
                max_pending_futures=self.max_pending_futures,
                next_step=CommitOffsets(commit),
            )
        elif self.mode == "multiprocess":
            logger.info("Starting multiprocess post process forwarder")
            return RunTaskWithMultiprocessing(
                function=self._dispatch_function,
                next_step=CommitOffsets(commit),
                num_processes=self.num_processes,
                max_batch_size=self.max_batch_size,
                max_batch_time=self.max_batch_time,
                input_block_size=self.input_block_size,
                output_block_size=self.output_block_size,
            )
        else:
            raise ValueError(f"Invalid mode {self.mode}")
