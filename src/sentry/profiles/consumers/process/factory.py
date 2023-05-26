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

from sentry.profiles.task import process_profile_task
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


def update_queue_stats(redis_cluster, backend) -> None:
    new_sizes = backend.bulk_get_sizes(QUEUES)
    # compute unhealthiness based on sizes
    unhealthy = {queue for (queue, size) in new_sizes if not is_healthy(size)}
    if unhealthy:
        with redis_cluster.pipeline(transaction=True) as pipeline:
            pipeline.delete(KEY_NAME)
            pipeline.sadd(KEY_NAME, *unhealthy)
            # expire in 1min if we haven't checked in
            pipeline.expire(KEY_NAME, 60)
            pipeline.execute()


def run_queue_stats_updater(redis_cluster: str) -> None:
    # bonus point if we manage to use asyncio and launch all tasks at once
    # in case we have many queues to check
    cluster = redis.redis_clusters.get(redis_cluster)
    from sentry.monitoring.queues import backend

    if backend is None:
        raise Exception("unknown broker type")
    while True:
        update_queue_stats(cluster, backend)
        sleep(5)


class QueueMonitor:
    def __init__(self, redis_cluster: str):
        queue_stats_updater_process = Thread(target=run_queue_stats_updater, args=(redis_cluster,))
        queue_stats_updater_process.start()


class ProcessProfileStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        _ = QueueMonitor(CLUSTER_NAME)
        return RunTask(
            function=process_message,
            next_step=CommitOffsets(commit),
        )
