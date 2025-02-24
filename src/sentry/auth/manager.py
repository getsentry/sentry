from __future__ import annotations

from collections.abc import Iterator
from typing import TYPE_CHECKING, Any

from .exceptions import ProviderNotRegistered

if TYPE_CHECKING:
    from sentry.auth.provider import Provider

__all__ = ("ProviderManager",)


# Ideally this and PluginManager abstracted from the same base, but
# InstanceManager has become convoluted and wasteful
class ProviderManager:
    def __init__(self) -> None:
        self.__values: dict[str, type[Provider]] = {}

    def __iter__(self) -> Iterator[tuple[str, type[Provider]]]:
        yield from self.__values.items()

    def get(self, key: str, **kwargs: Any) -> Provider:
        try:
            cls = self.__values[key]
        except KeyError:
            raise ProviderNotRegistered(key)
        return cls(**kwargs)

    def exists(self, key: str) -> bool:
        return key in self.__values

    def register(self, cls: type[Provider]) -> None:
        self.__values[cls.key] = cls

    def unregister(self, cls: type[Provider]) -> None:
        try:
            if self.__values[cls.key] != cls:
                # don't allow unregistering of arbitrary provider
                raise ProviderNotRegistered(cls.key)
        except KeyError:
            # we gracefully handle a missing provider
            return
        del self.__values[cls.key]
