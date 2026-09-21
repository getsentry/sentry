from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Any

from sentry.notifications.platform.provider import NotificationProvider
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationSource,
    NotificationTemplate,
)
from sentry.organizations.services.organization.model import RpcOrganizationSummary
from sentry.utils.registry import AlreadyRegisteredError, Registry


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


class NotificationRendererRegistry:
    """
    A registry for renderers which override a provider's default renderer. Renderers are keyed by
    the provider they produce output for, and the notification sources they render.
    """

    def __init__(self) -> None:
        self.registrations: dict[
            tuple[NotificationProviderKey, NotificationSource], type[NotificationRenderer[Any]]
        ] = {}

    def register[RenderableT](
        self, provider_key: NotificationProviderKey, sources: Sequence[NotificationSource]
    ) -> Callable[
        [type[NotificationRenderer[RenderableT]]], type[NotificationRenderer[RenderableT]]
    ]:
        if not sources:
            raise ValueError("At least one notification source is required to register a renderer")

        def inner(
            renderer: type[NotificationRenderer[RenderableT]],
        ) -> type[NotificationRenderer[RenderableT]]:
            for source in sources:
                key = (provider_key, source)
                if key in self.registrations:
                    raise AlreadyRegisteredError(
                        f"A registration already exists for {key}: {self.registrations[key]}"
                    )
                self.registrations[key] = renderer
            return renderer

        return inner

    def get(
        self, *, provider_key: NotificationProviderKey, source: NotificationSource
    ) -> type[NotificationRenderer[Any]] | None:
        """
        Returns the registered renderer for the provider/source pair, or `None` if the provider has
        no override and should fall back to its default renderer.
        """
        return self.registrations.get((provider_key, source))


provider_registry = NotificationProviderRegistry()
template_registry = Registry[type[NotificationTemplate[Any]]]()
renderer_registry = NotificationRendererRegistry()
