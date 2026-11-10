from __future__ import annotations

import builtins
from collections.abc import ItemsView, Iterator
from typing import Any

from sentry.plugins.providers import IntegrationRepositoryProvider


class ProviderManager:
    type: type[Any] | None = None

    def __init__(self) -> None:
        self._items: dict[str, type[Any]] = {}

    def __iter__(self) -> Iterator[str]:
        return iter(self._items)

    def add(self, item: builtins.type[Any], id: str) -> None:
        if self.type and not issubclass(item, self.type):
            raise ValueError(f"Invalid type for provider: {type(item)}")

        self._items[id] = item

    def get(self, id: str) -> builtins.type[Any]:
        return self._items[id]

    def all(self) -> ItemsView[str, builtins.type[Any]]:
        return self._items.items()


class IntegrationRepositoryProviderManager(ProviderManager):
    type = IntegrationRepositoryProvider


class BindingManager:
    BINDINGS: dict[str, type[ProviderManager]] = {
        "integration-repository.provider": IntegrationRepositoryProviderManager,
    }

    def __init__(self) -> None:
        self._bindings: dict[str, ProviderManager] = {k: v() for k, v in self.BINDINGS.items()}

    def add(self, name: str, binding: type[Any], **kwargs: Any) -> None:
        self._bindings[name].add(binding, **kwargs)

    def get(self, name: str) -> ProviderManager:
        return self._bindings[name]
