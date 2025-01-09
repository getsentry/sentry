from __future__ import annotations

import datetime
import logging
from collections.abc import Callable
from functools import cached_property
from typing import Any

from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from arroyo.types import Topic as ArroyoTopic
from django.conf import settings
from sentry_protos.sentry.v1.taskworker_pb2 import TaskActivation

from sentry.conf.types.kafka_definition import Topic
from sentry.taskworker.constants import DEFAULT_PROCESSING_DEADLINE
from sentry.taskworker.retry import Retry
from sentry.taskworker.router import TaskRouter
from sentry.taskworker.task import P, R, Task
from sentry.utils import metrics
from sentry.utils.imports import import_string
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger(__name__)


class TaskNamespace:
    """
    Task namespaces link topics, config and default retry mechanics together
    All tasks within a namespace are stored in the same topic and run by shared
    worker pool.
    """

    def __init__(
        self,
        name: str,
        topic: Topic,
        retry: Retry | None,
        expires: int | datetime.timedelta | None = None,
        processing_deadline_duration: int = DEFAULT_PROCESSING_DEADLINE,
    ):
        self.name = name
        self.topic = topic
        self.default_retry = retry
        self.default_expires = expires  # seconds
        self.default_processing_deadline_duration = processing_deadline_duration  # seconds
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
        """
        Get a registered task by name

        Raises KeyError when an unknown task is provided.
        """
        if name not in self._registered_tasks:
            raise KeyError(f"No task registered with the name {name}. Check your imports")
        return self._registered_tasks[name]

    def contains(self, name: str) -> bool:
        """
        Check if a task name has been registered
        """
        return name in self._registered_tasks

    def register(
        self,
        *,
        name: str,
        retry: Retry | None = None,
        expires: int | datetime.timedelta | None = None,
        processing_deadline_duration: int | datetime.timedelta | None = None,
        at_most_once: bool = False,
        wait_for_delivery: bool = False,
    ) -> Callable[[Callable[P, R]], Task[P, R]]:
        """
        Register a task.

        Applied as a decorator to functions to enable them to be run
        asynchronously via taskworkers.

        Parameters
        ----------

        name: str
            The name of the task. This is serialized and must be stable across deploys.
        retry: Retry | None
            The retry policy for the task. If none and at_most_once is not enabled
            the Task namespace default retry policy will be used.
        expires: int | datetime.timedelta
            The number of seconds a task activation is valid for. After this
            duration the activation will be discarded and not executed.
        at_most_once : bool
            Enable at-most-once execution. Tasks with `at_most_once` cannot
            define retry policies, and use a worker side idempotency key to
            prevent processing deadline based retries.
        wait_for_delivery: bool
            If true, the task will wait for the delivery report to be received
            before returning.
        """

        def wrapped(func: Callable[P, R]) -> Task[P, R]:
            task_retry = retry
            if not at_most_once:
                task_retry = retry or self.default_retry
            task = Task(
                name=name,
                func=func,
                namespace=self,
                retry=task_retry,
                expires=expires or self.default_expires,
                processing_deadline_duration=(
                    processing_deadline_duration or self.default_processing_deadline_duration
                ),
                at_most_once=at_most_once,
                wait_for_delivery=wait_for_delivery,
            )
            # TODO(taskworker) tasks should be registered into the registry
            # so that we can ensure task names are globally unique
            self._registered_tasks[name] = task
            return task

        return wrapped

    def send_task(self, activation: TaskActivation, wait_for_delivery: bool = False) -> None:
        metrics.incr("taskworker.registry.send_task", tags={"namespace": activation.namespace})

        produce_future = self.producer.produce(
            ArroyoTopic(name=self.topic.value),
            KafkaPayload(key=None, value=activation.SerializeToString(), headers=[]),
        )
        if wait_for_delivery:
            produce_future.result(timeout=None)


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

    def contains(self, name: str) -> bool:
        return name in self._namespaces

    def get(self, name: str) -> TaskNamespace:
        """Fetch a namespace by name."""
        if name not in self._namespaces:
            raise KeyError(f"No task namespace with the name {name}")
        return self._namespaces[name]

    def get_task(self, namespace: str, task: str) -> Task[Any, Any]:
        """Fetch a task by namespace and name."""
        return self.get(namespace).get(task)

    def create_namespace(
        self,
        name: str,
        *,
        retry: Retry | None = None,
        expires: int | datetime.timedelta | None = None,
        processing_deadline_duration: int = DEFAULT_PROCESSING_DEADLINE,
    ) -> TaskNamespace:
        """
        Create a namespaces.

        Namespaces are mapped onto topics through the configured router allowing
        infrastructure to be scaled based on a region's requirements.

        Namespaces can define default behavior for tasks defined within a namespace.
        """
        topic = self._router.route_namespace(name)
        namespace = TaskNamespace(
            name=name,
            topic=topic,
            retry=retry,
            expires=expires,
            processing_deadline_duration=processing_deadline_duration,
        )
        self._namespaces[name] = namespace

        return namespace


taskregistry = TaskRegistry()
