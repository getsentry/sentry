from collections.abc import Iterable
from typing import Any, Protocol

from sentry_protos.taskbroker.v1.taskbroker_pb2 import TaskActivation

from sentry.taskworker.registry import TaskRegistry


class AtMostOnceStore(Protocol):
    def add(self, key: str, value: str, timeout: int) -> bool: ...


class TaskworkerApp:
    def __init__(self, taskregistry: TaskRegistry | None = None) -> None:
        self._config = {
            "rpc_secret": None,
            "at_most_once_timeout": None,
        }
        self._modules: Iterable[str] = []
        self._taskregistry = taskregistry or TaskRegistry()

    @property
    def taskregistry(self) -> TaskRegistry:
        """Get the TaskRegistry instance from this app"""
        return self._taskregistry

    @property
    def config(self) -> dict[str, Any]:
        """Get the config data"""
        return self._config

    def set_config(self, config: dict[str, Any]) -> None:
        """
        Update the configuration values.
        """
        for key, value in config.items():
            if key in self._config:
                self._config[key] = value

    def set_modules(self, modules: Iterable[str]) -> None:
        """
        Set the list of modules to be loaded by workers when they start.
        """
        self._modules = modules

    def load_modules(self) -> None:
        """Load all of the configured modules"""
        for mod in self._modules:
            __import__(mod)

    def at_most_once_store(self, backend: AtMostOnceStore) -> None:
        self._at_most_once_store = backend

    def should_attempt_at_most_once(self, activation: TaskActivation) -> bool:
        if not self._at_most_once_store:
            return True
        key = get_at_most_once_key(
            activation.namespace,
            activation.taskname,
            activation.id,
        )
        return self._at_most_once_store.add(
            key, "1", timeout=self._config["at_most_once_timeout"] or 60
        )


def get_at_most_once_key(namespace: str, taskname: str, task_id: str) -> str:
    # tw:amo -> taskworker:at_most_once
    return f"tw:amo:{namespace}:{taskname}:{task_id}"
