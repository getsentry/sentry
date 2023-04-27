__all__ = ["IntegrationManager"]

from typing import Any, Dict, Iterable, Iterator, Type

from sentry.exceptions import NotRegistered
from sentry.integrations import IntegrationProvider


# Ideally this and PluginManager abstracted from the same base, but
# InstanceManager has become convoluted and wasteful
class IntegrationManager:
    def __init__(self) -> None:
        self.__values: Dict[str, Type[IntegrationProvider]] = {}

    def __iter__(self) -> Iterator[Type[IntegrationProvider]]:
        return iter(self.all())

    def all(self) -> Iterable[Type[IntegrationProvider]]:
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

    def register(self, cls: Type[IntegrationProvider]) -> None:
        self.__values[cls.key] = cls

    def unregister(self, cls: Type[IntegrationProvider]) -> None:
        try:
            if self.__values[cls.key] != cls:
                # don't allow unregistering of arbitrary provider
                raise NotRegistered(cls.key)
        except KeyError:
            # we gracefully handle a missing provider
            return
        del self.__values[cls.key]
