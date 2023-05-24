from multiprocessing import Process
from time import sleep
from typing import Any, Dict, Mapping

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import (
    MessageRejected,
    ProcessingStrategy,
    ProcessingStrategyFactory,
)
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import Commit, Message, Partition

from sentry.profiles.task import process_profile_task


def is_queue_healthy(queue_name: str) -> bool:
    # check if queue is healthy by pinging Redis
    return True


def process_message(message: Message[KafkaPayload]) -> None:
    if not is_queue_healthy("profiles.process"):
        raise MessageRejected()
    process_profile_task.s(payload=message.payload.value).apply_async()


def update_queue_stats(queue_name: str) -> Dict[str, Any]:
    # call the function to update queue stats
    return {}


def run_queue_stats_updater():
    # bonus point if we manage to use asyncio and launch all tasks at once
    # in case we have many queues to check
    while True:
        update_queue_stats("profiles.process")
        sleep(5)


class ProcessProfileStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        queue_stats_updater_process = Process(target=run_queue_stats_updater)
        queue_stats_updater_process.start()
        return RunTask(
            function=process_message,
            next_step=CommitOffsets(commit),
        )
