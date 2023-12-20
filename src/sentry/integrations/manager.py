from __future__ import annotations

from typing import Any, Iterable, Iterator

from sentry.exceptions import NotRegistered
from sentry.integrations import IntegrationProvider

__all__ = ["IntegrationManager"]


# Ideally this and PluginManager abstracted from the same base, but
# InstanceManager has become convoluted and wasteful
class IntegrationManager:
    def __init__(self) -> None:
        self.__values: dict[str, type[IntegrationProvider]] = {}

    def __iter__(self) -> Iterator[IntegrationProvider]:
        return iter(self.all())

    def all(self) -> Iterable[IntegrationProvider]:
        for key in self.__values.keys():
            integration = self.get(key)
            if integration.visible:
                yield integration

    def get(self, key: str, **kwargs: Any) -> IntegrationProvider:
        try:
            cls = self.__values[key]
        except KeyError:
            raise NotRegistered(key)
        return cls(**kwargs)

    def exists(self, key: str) -> bool:
        return key in self.__values

    def register(self, cls: type[IntegrationProvider]) -> None:
        self.__values[cls.key] = cls

    def unregister(self, cls: type[IntegrationProvider]) -> None:
        try:
            if self.__values[cls.key] != cls:
                # don't allow unregistering of arbitrary provider
                raise NotRegistered(cls.key)
        except KeyError:
            # we gracefully handle a missing provider
            return
        del self.__values[cls.key]
