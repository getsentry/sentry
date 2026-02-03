import importlib
from collections.abc import Iterable
from typing import Any, Protocol

from sentry_protos.taskbroker.v1.taskbroker_pb2 import TaskActivation

from sentry.taskworker.registry import TaskRegistry


class AtMostOnceStore(Protocol):
    def add(self, key: str, value: str, timeout: int) -> bool: ...


class TaskworkerApp:
    """
    Container for an application's task setup and configuration.
    """

    def __init__(self, name: str, taskregistry: TaskRegistry | None = None) -> None:
        self._config = {
            "rpc_secret": None,
            "at_most_once_timeout": None,
        }
        self.name = name
        self._modules: Iterable[str] = []
        self._taskregistry = taskregistry or TaskRegistry(application=name)
        self._at_most_once_store: AtMostOnceStore | None = None

    @property
    def taskregistry(self) -> TaskRegistry:
        """Get the TaskRegistry instance from this app"""
        return self._taskregistry

    @property
    def config(self) -> dict[str, Any]:
        """Get the config data"""
        return self._config

    def set_config(self, config: dict[str, Any]) -> None:
        """Update configuration data"""
        for key, value in config.items():
            if key in self._config:
                self._config[key] = value

    def set_modules(self, modules: Iterable[str]) -> None:
        """
        Set the list of modules containing tasks to be loaded by workers and schedulers.
        """
        self._modules = modules

    def load_modules(self) -> None:
        """Load all of the configured modules"""
        for mod in self._modules:
            __import__(mod)

    def at_most_once_store(self, backend: AtMostOnceStore) -> None:
        """
        Set the backend store for `at_most_once` tasks.
        The storage implementation should support atomic operations
        to avoid races with at_most_once tasks.
        """
        self._at_most_once_store = backend

    def should_attempt_at_most_once(self, activation: TaskActivation) -> bool:
        if not self._at_most_once_store:
            return True
        key = get_at_most_once_key(activation.namespace, activation.taskname, activation.id)
        return self._at_most_once_store.add(
            key, "1", timeout=self._config["at_most_once_timeout"] or 60
        )


def get_at_most_once_key(namespace: str, taskname: str, task_id: str) -> str:
    # tw:amo -> taskworker:at_most_once
    return f"tw:amo:{namespace}:{taskname}:{task_id}"


def import_app(app_module: str) -> TaskworkerApp:
    """
    Resolve an application path like `acme.worker.runtime:app`
    into the `app` symbol defined in the module.
    """
    module_name, name = app_module.split(":")
    module = importlib.import_module(module_name)
    return getattr(module, name)
