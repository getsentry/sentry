from collections.abc import Mapping

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import Commit as ArroyoCommit
from arroyo.types import Partition

from sentry.replays.consumers.buffered.consumer import Flags, recording_runtime
from sentry.replays.consumers.buffered.platform import PlatformStrategy


class PlatformStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):

    def __init__(self, max_buffer_length: int, max_buffer_wait: int, max_workers: int) -> None:
        self.flags: Flags = {
            "max_buffer_length": max_buffer_length,
            "max_buffer_wait": max_buffer_wait,
            "max_workers": max_workers,
        }

    def create_with_partitions(
        self,
        commit: ArroyoCommit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return PlatformStrategy(commit=commit, flags=self.flags, runtime=recording_runtime)
