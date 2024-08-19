from __future__ import annotations

from functools import wraps
from typing import Any


class TaskNamespace:
    """
    Task namespaces link topics, config and default retry mechanics together
    All tasks within a namespace are stored in the same topic and run by shared
    worker pool.
    """

    def __init__(self, name: str, topic: str, deadletter_topic: str, retry: Any):
        self.name = name
        self.topic = topic
        self.deadletter_topic = deadletter_topic
        self.default_retry = retry
        # TODO how to get producer?

    def register(self, name: str):
        """register a task, used as a decorator"""
        # TODO add .delay and .apply_async methods
        def wrapped(func):
            @wraps(func)
            def inner_wrapper(*args, **kwargs) -> Any:
                return func(*args, **kwargs)

            return inner_wrapper

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
