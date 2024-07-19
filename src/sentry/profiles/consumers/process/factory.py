from collections.abc import Iterable, Mapping

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import Commit, Message, Partition

from sentry import options
from sentry.processing.backpressure.arroyo import HealthChecker, create_backpressure_step
from sentry.profiles.task import process_profile_task


def process_message(message: Message[KafkaPayload]) -> None:
    sampled = is_sampled(message.payload.headers)

    if sampled or options.get("profiling.profile_metrics.unsampled_profiles.enabled"):
        process_profile_task.s(payload=message.payload.value, sampled=sampled).apply_async()


class ProcessProfileStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(self) -> None:
        super().__init__()
        self.health_checker = HealthChecker("profiles")

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        next_step = RunTask(
            function=process_message,
            next_step=CommitOffsets(commit),
        )
        return create_backpressure_step(
            health_checker=self.health_checker,
            next_step=next_step,
        )


def is_sampled(headers: Iterable[tuple[str, str | bytes]]) -> bool:
    for k, v in headers:
        if k == "sampled":
            if isinstance(v, bytes):
                return v.decode("utf-8") == "true"
    return True
