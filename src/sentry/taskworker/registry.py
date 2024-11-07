from __future__ import annotations

import logging
from collections.abc import Callable
from functools import cached_property
from typing import Any

from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from arroyo.types import Topic as ArroyoTopic
from django.conf import settings
from sentry_protos.sentry.v1.taskworker_pb2 import TaskActivation

from sentry.conf.types.kafka_definition import Topic
from sentry.taskworker.retry import Retry
from sentry.taskworker.router import TaskRouter
from sentry.taskworker.task import P, R, Task
from sentry.utils.imports import import_string
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger(__name__)


class TaskNamespace:
    """
    Task namespaces link topics, config and default retry mechanics together
    All tasks within a namespace are stored in the same topic and run by shared
    worker pool.
    """

    def __init__(self, name: str, topic: Topic, retry: Retry | None):
        # TODO(taskworker) implement default deadlines for tasks
        self.name = name
        self.topic = topic
        self.default_retry = retry
        self._registered_tasks: dict[str, Task[Any, Any]] = {}
        self._producer: KafkaProducer | None = None

    @cached_property
    def producer(self) -> KafkaProducer:
        if self._producer:
            return self._producer
        cluster_name = get_topic_definition(self.topic)["cluster"]
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
            ArroyoTopic(name=self.topic.value),
            KafkaPayload(key=None, value=activation.SerializeToString(), headers=[]),
        )


class TaskRegistry:
    """
    Registry of all namespaces.

    The TaskRegistry is responsible for handling namespace -> topic resolution
    during startup.
    """

    def __init__(self) -> None:
        self._namespaces: dict[str, TaskNamespace] = {}
        self._router = self._build_router()

    def _build_router(self) -> TaskRouter:
        router_name: str = settings.TASKWORKER_ROUTER
        router_class = import_string(router_name)
        router = router_class()
        assert hasattr(router, "route_namespace")

        return router

    def get(self, name: str) -> TaskNamespace:
        """Fetch a namespace by name."""
        if name not in self._namespaces:
            raise KeyError(f"No task namespace with the name {name}")
        return self._namespaces[name]

    def get_task(self, namespace: str, task: str) -> Task[Any, Any]:
        """Fetch a task by namespace and name."""
        return self.get(namespace).get(task)

    def import_tasks(self) -> None:
        """Import all the modules listed in settings.TASKWORKER_IMPORTS"""
        imports = settings.TASKWORKER_IMPORTS
        for module in imports:
            __import__(module)

    def create_namespace(self, name: str, retry: Retry | None = None) -> TaskNamespace:
        """
        Create a namespaces.

        Namespaces can define default retry policies, deadlines.

        Namespaces are mapped onto topics with a router allowing
        infrastructure to be scaled based on a region's requirements.
        """
        topic = self._router.route_namespace(name)
        namespace = TaskNamespace(name=name, topic=topic, retry=retry)
        self._namespaces[name] = namespace

        return namespace


taskregistry = TaskRegistry()
