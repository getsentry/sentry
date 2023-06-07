from threading import Thread
from time import sleep
from typing import Mapping

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import (
    MessageRejected,
    ProcessingStrategy,
    ProcessingStrategyFactory,
)
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import Commit, Message, Partition

from sentry.monitoring.queues import is_queue_healthy, monitor_queues
from sentry.profiles.task import process_profile_task

was_queue_healthy = True


def process_message(message: Message[KafkaPayload]) -> None:
    if not was_queue_healthy:
        raise MessageRejected()
    process_profile_task.s(payload=message.payload.value).apply_async()


def _run_backpressure_updater() -> None:
    global was_queue_healthy
    while True:
        was_queue_healthy = is_queue_healthy("profiles.process")
        sleep(5)


def check_for_backpressure() -> None:
    Thread(
        target=_run_backpressure_updater,
    ).start()


class ProcessProfileStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(self) -> None:
        super().__init__()
        monitor_queues()
        check_for_backpressure()

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTask(
            function=process_message,
            next_step=CommitOffsets(commit),
        )
