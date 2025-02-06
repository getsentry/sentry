from collections.abc import Iterable, Mapping

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import Commit, Message, Partition

from sentry import options
from sentry.processing.backpressure.arroyo import HealthChecker, create_backpressure_step
from sentry.profiles.task import process_profile_task
from sentry.utils.arroyo import MultiprocessingPool, run_task_with_multiprocessing


def process_message(message: Message[KafkaPayload]) -> None:
    sampled = is_sampled(message.payload.headers)

    if sampled or options.get("profiling.profile_metrics.unsampled_profiles.enabled"):
        process_profile_task.s(payload=message.payload.value, sampled=sampled).apply_async()


class ProcessProfileStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        max_batch_size: int,
        max_batch_time: int,
        num_processes: int,
        input_block_size: int | None,
        output_block_size: int | None,
    ) -> None:
        super().__init__()
        self.health_checker = HealthChecker("profiles")
        self.input_block_size = input_block_size
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.output_block_size = output_block_size
        self._pool = MultiprocessingPool(num_processes)

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        next_step = run_task_with_multiprocessing(
            function=process_message,
            next_step=CommitOffsets(commit),
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            pool=self._pool,
            input_block_size=self.input_block_size,
            output_block_size=self.output_block_size,
        )
        return create_backpressure_step(
            health_checker=self.health_checker,
            next_step=next_step,
        )

    def shutdown(self) -> None:
        self._pool.close()


def is_sampled(headers: Iterable[tuple[str, str | bytes]]) -> bool:
    for k, v in headers:
        if k == "sampled":
            if isinstance(v, bytes):
                return v.decode("utf-8") == "true"
    return True
