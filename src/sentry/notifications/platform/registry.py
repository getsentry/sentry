from __future__ import annotations

from typing import Any

from sentry.notifications.platform.provider import NotificationProvider
from sentry.organizations.services.organization.model import RpcOrganizationSummary
from sentry.utils.registry import Registry


class NotificationProviderRegistry(Registry[type[NotificationProvider[Any]]]):
    """
    A registry for notification providers. Adds `get_all` and `get_available` methods to the base registry.
    """

    def get_all(self) -> list[type[NotificationProvider[Any]]]:
        """
        Returns every NotificationProvider that has been registered. Some providers may not be
        available generally available to all customers. For only released providers, use `get_available` instead.
        """
        return list(self.registrations.values())

    def get_available(
        self, *, organization: RpcOrganizationSummary | None = None
    ) -> list[type[NotificationProvider[Any]]]:
        """
        Returns every registered NotificationProvider that has been released to all customers.
        """
        return [
            provider
            for provider in self.registrations.values()
            if provider.is_available(organization=organization)
        ]


provider_registry = NotificationProviderRegistry()
