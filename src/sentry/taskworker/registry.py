from __future__ import annotations

import logging
from collections.abc import Callable
from functools import cached_property
from typing import Any

from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from arroyo.types import Topic as ArroyoTopic
from sentry_protos.sentry.v1.taskworker_pb2 import TaskActivation

from sentry.conf.types.kafka_definition import Topic
from sentry.taskworker.retry import Retry
from sentry.taskworker.task import P, R, Task
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger(__name__)


class TaskNamespace:
    """
    Task namespaces link topics, config and default retry mechanics together
    All tasks within a namespace are stored in the same topic and run by shared
    worker pool.
    """

    def __init__(self, name: str, topic: str, deadletter_topic: str, retry: Retry | None):
        # TODO(taskworker) implement default deadlines for tasks
        self.name = name
        self.topic = topic
        self.deadletter_topic = deadletter_topic
        self.default_retry = retry
        self._registered_tasks: dict[str, Task[Any, Any]] = {}
        self._producer: KafkaProducer | None = None

    @cached_property
    def producer(self) -> KafkaProducer:
        if self._producer:
            return self._producer
        cluster_name = get_topic_definition(Topic.TASK_WORKER)["cluster"]
        producer_config = get_kafka_producer_cluster_options(cluster_name)
        self._producer = KafkaProducer(producer_config)

        return self._producer

    def get(self, name: str) -> Task[Any, Any]:
        if name not in self._registered_tasks:
            raise KeyError(f"No task registered with the name {name}. Check your imports")
        return self._registered_tasks[name]

    def contains(self, name: str) -> bool:
        return name in self._registered_tasks

    def register(
        self,
        *,
        name: str,
        idempotent: bool = False,
        retry: Retry | None = None,
    ) -> Callable[[Callable[P, R]], Task[P, R]]:
        """register a task, used as a decorator"""

        def wrapped(func: Callable[P, R]) -> Task[P, R]:
            # TODO(taskworker) Implement task deadlines
            task = Task(
                name=name,
                func=func,
                namespace=self,
                idempotent=idempotent,
                retry=retry or self.default_retry,
            )
            # TODO(taskworker) tasks should be registered into the registry
            # so that we can ensure task names are globally unique
            self._registered_tasks[name] = task
            return task

        return wrapped

    def send_task(self, activation: TaskActivation) -> None:
        # TODO(taskworker) producer callback handling
        self.producer.produce(
            ArroyoTopic(name=self.topic),
            KafkaPayload(key=None, value=activation.SerializeToString(), headers=[]),
        )


# TODO(taskworker) Import TaskRegistrys
