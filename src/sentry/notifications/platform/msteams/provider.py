from typing import Any

from sentry.notifications.platform.provider import NotificationProvider, NotificationProviderKey
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.organizations.services.organization.model import RpcOrganizationSummary

# TODO(ecosystem): Figure out a way to use 'AdaptiveCard' type
type MSTeamsRenderable = Any


class MSTeamsRenderer(NotificationRenderer[MSTeamsRenderable]):
    provider_key = NotificationProviderKey.MSTEAMS


@provider_registry.register(NotificationProviderKey.MSTEAMS)
class MSTeamsNotificationProvider(NotificationProvider[MSTeamsRenderable]):
    key = NotificationProviderKey.MSTEAMS

    @classmethod
    def is_available(cls, *, organization: RpcOrganizationSummary | None = None) -> bool:
        # TODO(ecosystem): Check for the integration, maybe a feature as well
        return False

    @property
    def default_renderer(self) -> MSTeamsRenderer:
        return MSTeamsRenderer()
