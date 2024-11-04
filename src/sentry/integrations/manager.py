from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Iterator
from typing import Any

from sentry.exceptions import NotRegistered
from sentry.integrations.base import IntegrationDomain, IntegrationProvider

__all__ = ["IntegrationManager"]


# Ideally this and PluginManager abstracted from the same base, but
# InstanceManager has become convoluted and wasteful
class IntegrationManager:
    def __init__(self) -> None:
        self.__values: dict[str, type[IntegrationProvider]] = {}
        self.__domain_integrations: dict[IntegrationDomain, list[str]] = defaultdict(
            list
        )  # integrations by domain
        self.__integration_domains: dict[str, IntegrationDomain] = (
            {}
        )  # map of integration to domain

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
        if cls.domain:
            self.__domain_integrations[cls.domain].append(cls.key)
            self.__integration_domains[cls.key] = cls.domain

    def unregister(self, cls: type[IntegrationProvider]) -> None:
        try:
            if self.__values[cls.key] != cls:
                # don't allow unregistering of arbitrary provider
                raise NotRegistered(cls.key)
        except KeyError:
            # we gracefully handle a missing provider
            return
        del self.__values[cls.key]

    def get_integrations_for_domain(self, domain: IntegrationDomain) -> list[str]:
        if domain not in self.__domain_integrations:
            return []
        return self.__domain_integrations[domain]

    def get_integrations_by_domain(self) -> dict[IntegrationDomain, list[str]]:
        return self.__domain_integrations

    def get_integration_domain(self, key: str) -> IntegrationDomain:
        if key not in self.__integration_domains:
            raise NotRegistered(key)
        return self.__integration_domains[key]


default_manager = IntegrationManager()
all = default_manager.all
get = default_manager.get
exists = default_manager.exists
register = default_manager.register
unregister = default_manager.unregister
