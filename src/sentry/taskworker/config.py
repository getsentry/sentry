from __future__ import annotations

import time
from collections.abc import Mapping
from datetime import timedelta
from typing import Any
from uuid import uuid4

from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from arroyo.types import Topic as ArroyoTopic

from sentry.conf.types.kafka_definition import Topic
from sentry.taskworker.retry import FALLBACK_RETRY, Retry
from sentry.taskworker.task import Task
from sentry.utils import json
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition


class TaskNamespace:
    """
    Task namespaces link topics, config and default retry mechanics together
    All tasks within a namespace are stored in the same topic and run by shared
    worker pool.
    """

    __registered_tasks: dict[str, Task]
    __producer: KafkaProducer | None = None

    def __init__(self, name: str, topic: str, deadletter_topic: str, retry: Retry | None):
        self.name = name
        self.topic = topic
        self.deadletter_topic = deadletter_topic
        self.default_retry = retry
        self.__registered_tasks = {}

    @property
    def producer(self) -> KafkaProducer:
        if self.__producer:
            return self.__producer
        cluster_name = get_topic_definition(Topic.HACKWEEK)["cluster"]
        producer_config = get_kafka_producer_cluster_options(cluster_name)
        self.__producer = KafkaProducer(producer_config)

        return self.__producer

    def get(self, name: str) -> Task:
        if name not in self.__registered_tasks:
            raise KeyError(f"No task registered with that name. Check your imports")
        return self.__registered_tasks[name]

    def register(
        self,
        name: str,
        idempotent: bool | None = None,
        deadline: timedelta | int | None = None,
        retry: Retry | None = None,
    ):
        """register a task, used as a decorator"""

        def wrapped(func):
            task = Task(
                name=name,
                func=func,
                namespace=self,
                idempotent=idempotent,
                deadline=deadline,
                retry=retry,
            )
            self.__registered_tasks[name] = task
            return task

        return wrapped

    def send_task(self, task: Task, args, kwargs) -> None:
        task_message = self._serialize_task_call(task, args, kwargs)
        # TODO this could use an RPC instead of appending to the topic directly
        # TODO callback handling
        self.producer.produce(
            ArroyoTopic(name=self.topic),
            KafkaPayload(key=None, value=task_message.encode("utf-8"), headers=[]),
        )

    def _serialize_task_call(self, task: Task, args: list[Any], kwargs: Mapping[Any, Any]) -> str:
        retry = task.retry or self.default_retry or FALLBACK_RETRY

        task_payload = {
            "id": uuid4().hex,
            "namespace": self.name,
            "taskname": task.name,
            "parameters": {"args": args, "kwargs": kwargs},
            "received_at": time.time(),
            # TODO headers, retry_state and retries in general
            "headers": {},
            "retry_state": retry.initial_state().to_dict(),
            "deadline": task.deadline_timestamp,
        }
        return json.dumps(task_payload)


class TaskRegistry:
    """Registry of all namespaces"""

    __namespaces: dict[str, TaskNamespace]

    def __init__(self):
        self.__namespaces = {}

    def get(self, name: str) -> TaskNamespace:
        if name not in self.__namespaces:
            raise KeyError(f"No task namespace with that name")
        return self.__namespaces[name]

    def get_task(self, namespace: str, task: str) -> Task:
        return self.get(namespace).get(task)

    def create_namespace(self, name: str, topic: str, deadletter_topic: str, retry: Any):
        # TODO So much
        # - validate topic names
        # - validate deadletter topic
        # - do topic : cluster resolution
        namespace = TaskNamespace(
            name=name, topic=topic, deadletter_topic=deadletter_topic, retry=retry
        )
        self.__namespaces[name] = namespace

        return namespace


taskregistry = TaskRegistry()
