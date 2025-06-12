from typing import Any

from sentry.notifications.platform.provider import NotificationProvider, NotificationProviderKey
from sentry.notifications.platform.registry import provider_registry
from sentry.organizations.services.organization.model import RpcOrganizationSummary

# TODO(ecosystem): Figure out a way to use 'AdaptiveCard' type
MSTeamsMessage = Any


@provider_registry.register(NotificationProviderKey.MSTEAMS)
class MSTeamsNotificationProvider(NotificationProvider[MSTeamsMessage]):
    key = NotificationProviderKey.MSTEAMS

    @classmethod
    def is_available(cls, *, organization: RpcOrganizationSummary | None = None) -> bool:
        # TODO(ecosystem): Check for the integration, maybe a feature as well
        return False
