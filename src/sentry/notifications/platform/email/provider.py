from typing import Any

from sentry.notifications.platform.provider import NotificationProvider, NotificationProviderKey
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.organizations.services.organization.model import RpcOrganizationSummary

# TODO(ecosystem): Proper typing for email payloads (HTML + txt)
type EmailRenderable = Any


class EmailRenderer(NotificationRenderer[EmailRenderable]):
    provider_key = NotificationProviderKey.EMAIL


@provider_registry.register(NotificationProviderKey.EMAIL)
class EmailNotificationProvider(NotificationProvider[EmailRenderable]):
    key = NotificationProviderKey.EMAIL

    @classmethod
    def is_available(cls, *, organization: RpcOrganizationSummary | None = None) -> bool:
        return True

    @property
    def default_renderer(self) -> EmailRenderer:
        return EmailRenderer()
