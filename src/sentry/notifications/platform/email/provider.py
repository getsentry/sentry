from typing import Any

from sentry.notifications.platform.provider import NotificationProvider
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.target import GenericNotificationTarget
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationRenderer,
    NotificationTargetResourceType,
    NotificationTemplate,
)
from sentry.organizations.services.organization.model import RpcOrganizationSummary

# TODO(ecosystem): Proper typing for email payloads (HTML + txt)
type EmailRenderable = Any


class EmailRenderer(NotificationRenderer[EmailRenderable]):
    provider_key = NotificationProviderKey.EMAIL

    @classmethod
    def render[
        T: NotificationData
    ](cls, *, data: T, template: NotificationTemplate[T]) -> EmailRenderable:
        return {}


@provider_registry.register(NotificationProviderKey.EMAIL)
class EmailNotificationProvider(NotificationProvider[EmailRenderable]):
    key = NotificationProviderKey.EMAIL
    default_renderer = EmailRenderer
    target_class = GenericNotificationTarget
    target_resource_types = [NotificationTargetResourceType.EMAIL]

    @classmethod
    def is_available(cls, *, organization: RpcOrganizationSummary | None = None) -> bool:
        return True
