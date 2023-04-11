from typing import Callable, Mapping

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
    RunTaskInThreads,
)
from arroyo.types import Commit, Message, Partition


class PostProcessForwarderStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self, dispatch_function: Callable[[Message[KafkaPayload]], None], concurrency: int
    ):
        self.__dispatch_function = dispatch_function
        self.__concurrency = concurrency
        self.__max_pending_futures = concurrency + 1000

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTaskInThreads(
            self.__dispatch_function,
            self.__concurrency,
            self.__max_pending_futures,
            CommitOffsets(commit),
        )
