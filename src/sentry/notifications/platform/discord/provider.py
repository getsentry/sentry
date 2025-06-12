from typing import Any

from sentry.notifications.platform.provider import NotificationProvider, NotificationProviderKey
from sentry.notifications.platform.registry import provider_registry
from sentry.organizations.services.organization.model import RpcOrganizationSummary

# TODO(ecosystem): Proper typing - https://discord.com/developers/docs/resources/message#create-message
DiscordMessage = Any


@provider_registry.register(NotificationProviderKey.DISCORD)
class DiscordNotificationProvider(NotificationProvider[DiscordMessage]):
    key = NotificationProviderKey.DISCORD

    @classmethod
    def is_available(cls, *, organization: RpcOrganizationSummary | None = None) -> bool:
        # TODO(ecosystem): Check for the integration, maybe a feature as well
        return False
