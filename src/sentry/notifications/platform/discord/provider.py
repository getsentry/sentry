from typing import Any

from sentry.notifications.platform.provider import NotificationProvider
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
    NotificationTarget,
    NotificationTargetResourceType,
)
from sentry.organizations.services.organization.model import RpcOrganizationSummary

# TODO(ecosystem): Proper typing - https://discord.com/developers/docs/resources/message#create-message
type DiscordRenderable = Any


class DiscordRenderer(NotificationRenderer[DiscordRenderable]):
    provider_key = NotificationProviderKey.DISCORD

    @classmethod
    def render[
        DataT: NotificationData
    ](cls, *, data: DataT, rendered_template: NotificationRenderedTemplate) -> DiscordRenderable:
        return {}


@provider_registry.register(NotificationProviderKey.DISCORD)
class DiscordNotificationProvider(NotificationProvider[DiscordRenderable]):
    key = NotificationProviderKey.DISCORD
    default_renderer = DiscordRenderer
    target_class = IntegrationNotificationTarget
    target_resource_types = [
        NotificationTargetResourceType.CHANNEL,
        NotificationTargetResourceType.DIRECT_MESSAGE,
    ]

    @classmethod
    def is_available(cls, *, organization: RpcOrganizationSummary | None = None) -> bool:
        # TODO(ecosystem): Check for the integration, maybe a feature as well
        return False

    @classmethod
    def send(cls, *, target: NotificationTarget, renderable: DiscordRenderable) -> None:
        pass
