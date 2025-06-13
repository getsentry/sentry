from typing import Any

from sentry.notifications.platform.provider import NotificationProvider
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.types import NotificationProviderKey
from sentry.organizations.services.organization.model import RpcOrganizationSummary

# TODO(ecosystem): Proper typing - https://discord.com/developers/docs/resources/message#create-message
type DiscordRenderable = Any


class DiscordRenderer(NotificationRenderer[DiscordRenderable]):
    provider_key = NotificationProviderKey.DISCORD


@provider_registry.register(NotificationProviderKey.DISCORD)
class DiscordNotificationProvider(NotificationProvider[DiscordRenderable]):
    key = NotificationProviderKey.DISCORD
    default_renderer = DiscordRenderer

    @classmethod
    def is_available(cls, *, organization: RpcOrganizationSummary | None = None) -> bool:
        # TODO(ecosystem): Check for the integration, maybe a feature as well
        return False
