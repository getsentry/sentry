from __future__ import annotations

import logging
import time
from collections.abc import Mapping
from datetime import timedelta
from functools import cached_property
from typing import Any
from uuid import uuid4

import orjson
from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from arroyo.types import Topic as ArroyoTopic
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.sentry.v1.taskworker_pb2 import RetryState, TaskActivation

from sentry.conf.types.kafka_definition import Topic
from sentry.taskworker.retry import FALLBACK_RETRY, Retry
from sentry.taskworker.task import Task
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
        self._registered_tasks: dict[str, Task] = {}
        self._producer: KafkaProducer | None = None

    @cached_property
    def producer(self) -> KafkaProducer:
        if self._producer:
            return self._producer
        cluster_name = get_topic_definition(Topic.TASK_WORKER)["cluster"]
        producer_config = get_kafka_producer_cluster_options(cluster_name)
        self._producer = KafkaProducer(producer_config)

        return self._producer

    def get(self, name: str) -> Task:
        if name not in self._registered_tasks:
            raise KeyError(f"No task registered with the name {name}. Check your imports")
        return self._registered_tasks[name]

    def contains(self, name: str) -> bool:
        return name in self._registered_tasks

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
                retry=retry or self.default_retry,
            )
            # TODO(taskworker) tasks should be registered into the registry
            # so that we can ensure task names are globally unique
            self._registered_tasks[name] = task
            return task

        return wrapped

    def retry_task(self, taskdata: TaskActivation) -> None:
        self.producer.produce(
            ArroyoTopic(name=self.topic),
            KafkaPayload(key=None, value=taskdata.SerializeToString(), headers=[]),
        )

    def send_task(self, task: Task, args, kwargs) -> None:
        task_message = self._serialize_task_call(task, args, kwargs)
        # TODO(taskworker) this could use an RPC instead of appending to the topic directly
        # TODO(taskworker) callback handling
        self.producer.produce(
            ArroyoTopic(name=self.topic),
            KafkaPayload(key=None, value=task_message, headers=[]),
        )

    def _serialize_task_call(self, task: Task, args: list[Any], kwargs: Mapping[Any, Any]) -> bytes:
        # TODO(taskworker) There shouldn't be a FALLBACK_RETRY
        retry = task.retry or self.default_retry or FALLBACK_RETRY

        retry_state = RetryState(
            attempts=retry.initial_state().attempts,
            kind=retry.initial_state().kind,
            discard_after_attempt=retry.initial_state().discard_after_attempt,
            deadletter_after_attempt=retry.initial_state().deadletter_after_attempt,
        )
        pending_task_payload = TaskActivation(
            id=uuid4().hex,
            namespace=self.name,
            taskname=task.name,
            parameters=str(orjson.dumps({"args": args, "kwargs": kwargs})),
            retry_state=retry_state,
            received_at=Timestamp(seconds=int(time.time())),
        ).SerializeToString()

        return pending_task_payload


# TODO(taskworker) Import TaskRegistrys
