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

logger = logging.getLogger(__name__)


class PostProcessForwarderStrategyFactory(ProcessingStrategyFactory[KafkaPayload], ABC):
    @abstractmethod
    def _dispatch_function(self, message: Message[KafkaPayload]) -> None:
        raise NotImplementedError()

    def __init__(self, concurrency: int):
        self.__concurrency = concurrency
        self.__max_pending_futures = concurrency + 1000

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTaskInThreads(
            self._dispatch_function,
            self.__concurrency,
            self.__max_pending_futures,
            CommitOffsets(commit),
        )
