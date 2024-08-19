from __future__ import annotations

from typing import Any

from sentry.taskworker.task import Task


class TaskNamespace:
    """
    Task namespaces link topics, config and default retry mechanics together
    All tasks within a namespace are stored in the same topic and run by shared
    worker pool.
    """

    __registered_tasks: dict[str, Task]

    def __init__(self, name: str, topic: str, deadletter_topic: str, retry: Any):
        self.name = name
        self.topic = topic
        self.deadletter_topic = deadletter_topic
        self.default_retry = retry
        self.__registered_tasks = {}
        # TODO how to get producer?

    def send_task(self, task: Task, args, kwargs) -> None:
        # TODO serialize task message and send RPC/publish
        ...

    def register(self, name: str):
        """register a task, used as a decorator"""

        def wrapped(func):
            task = Task(name=name, func=func, namespace=self)
            self.__registered_tasks[name] = task
            return task

        return wrapped


class TaskRegistry:
    """Registry of all namespaces"""

    __namespaces: dict[str, TaskNamespace]

    def __init__(self):
        self.__namespaces = {}

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
