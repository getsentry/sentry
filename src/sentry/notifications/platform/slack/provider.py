from typing import Any

from sentry.notifications.platform.provider import NotificationProvider
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationTarget,
    NotificationTargetResourceType,
    NotificationTemplate,
)
from sentry.organizations.services.organization.model import RpcOrganizationSummary

# TODO(ecosystem): Figure out a way to use 'SlackBlock' type
type SlackRenderable = Any


class SlackRenderer(NotificationRenderer[SlackRenderable]):
    provider_key = NotificationProviderKey.DISCORD

    @classmethod
    def render[
        DataT: NotificationData
    ](cls, *, data: DataT, template: NotificationTemplate) -> SlackRenderable:
        return {}


@provider_registry.register(NotificationProviderKey.SLACK)
class SlackNotificationProvider(NotificationProvider[SlackRenderable]):
    key = NotificationProviderKey.SLACK
    default_renderer = SlackRenderer
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
    def send(cls, *, target: NotificationTarget, renderable: SlackRenderable) -> None:
        pass
