from multiprocessing import Process
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

from sentry.monitoring.queues import AmqpBackend
from sentry.profiles.task import process_profile_task
from sentry.server import settings
from sentry.utils import redis

QUEUES = ["profiles.process"]

KEY_NAME = "unhealthy-queues"

CLUSTER_NAME = "default"

cluster = redis.redis_clusters.get(CLUSTER_NAME)


def is_queue_healthy(queue_name: str) -> bool:
    # check if queue is healthy by pinging Redis
    return not cluster.sismember(KEY_NAME, queue_name)


def process_message(message: Message[KafkaPayload]) -> None:
    if not is_queue_healthy("profiles.process"):
        raise MessageRejected()
    process_profile_task.s(payload=message.payload.value).apply_async()


def is_healthy(queue_size):
    return queue_size < 1000


def update_queue_stats(redis_cluster, backend: AmqpBackend) -> None:
    new_sizes = backend.bulk_get_sizes(QUEUES)
    # compute this based on sizes
    unhealthy = {queue for (queue, size) in new_sizes if not is_healthy(size)}
    with redis_cluster.pipeline(transaction=True) as pipeline:
        pipeline.delete(KEY_NAME)
        pipeline.sadd(KEY_NAME, *unhealthy)
        pipeline.execute()


def run_queue_stats_updater(broker_url: str, redis_cluster: str) -> None:
    # bonus point if we manage to use asyncio and launch all tasks at once
    # in case we have many queues to check
    cluster = redis.redis_clusters.get(redis_cluster)
    backend = AmqpBackend(broker_url)
    while True:
        update_queue_stats(cluster, backend)
        sleep(5)


class QueueMonitor:
    def __init__(self, broker_url, redis_cluster: str):
        queue_stats_updater_process = Process(
            target=self.run_queue_stats_updater, args=(broker_url, redis_cluster)
        )
        queue_stats_updater_process.start()


class ProcessProfileStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        _ = QueueMonitor(settings.BROKER_URL, CLUSTER_NAME)
        return RunTask(
            function=process_message,
            next_step=CommitOffsets(commit),
        )
