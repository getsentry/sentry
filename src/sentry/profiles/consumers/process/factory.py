from time import time
from typing import Mapping

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import Commit, Message, Partition

from sentry import options
from sentry.monitoring.queues import is_queue_healthy, monitor_queues
from sentry.processing.backpressure.arroyo import HealthChecker, create_backpressure_step
from sentry.profiles.task import process_profile_task


def process_message(message: Message[KafkaPayload]) -> None:
    process_profile_task.s(payload=message.payload.value).apply_async()


class ProfilesHealthChecker(HealthChecker):
    def __init__(self):
        self.last_check = 0
        # Queue is healthy by default
        self.is_queue_healthy = True

    def is_healthy(self) -> bool:
        now = time()
        # Check queue health if it's been more than the interval
        if now - self.last_check >= options.get(
            "backpressure.monitor_queues.check_interval_in_seconds"
        ):
            self.is_queue_healthy = is_queue_healthy("profiles.process")
            # We don't count the time it took to check as part of the interval
            self.last_check = now
        return self.is_queue_healthy


class ProcessProfileStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(self) -> None:
        super().__init__()
        self.health_checker = ProfilesHealthChecker()
        monitor_queues()

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
