from dataclasses import dataclass, field
from typing import Any

from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import (
    RpcIntegration,
    RpcOrganizationIntegration,
)
from sentry.notifications.platform.provider import NotificationProvider
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)


class NotificationTargetError(Exception):
    pass


@dataclass(kw_only=True)
class NotificationTarget:
    """
    A designated recipient for a notification. This could be a user, a team, or a channel.
    Accepts the renderable object type that matches the connected provider.
    """

    provider_key: NotificationProviderKey
    resource_type: NotificationTargetResourceType
    resource_id: str
    """
    The identifier that a provider can use to access or send to the given resource.
    For example, an email address, a slack channel ID, a discord user ID, etc.
    """
    specific_data: dict[str, Any] | None = field(default=None)
    """
    Arbitrary data that is specific to the target; for example, a link to a user's notification settings.

    When possible, consider whether this is really necessary as it produces inconsistencies across recipients, which may be lead to confusion.
    If all targets use the same payload, please add this to the NotificationTemplate instead.
    """
    provider: type[NotificationProvider[Any]] = field(init=False)

    def __post_init__(self) -> None:
        self.provider = provider_registry.get(self.provider_key)
        # TODO(ecosystem): Figure out a system for validating specific data.
        # Should it happen on the provider, template, or something else?


@dataclass(kw_only=True)
class IntegrationNotificationTarget(NotificationTarget):
    """
    Adds necessary properties and methods to designate a target within an integration.
    Accepts the renderable object type that matches the connected provider.
    """

    integration_id: int
    organization_id: int
    integration: RpcIntegration = field(init=False)
    organization_integration: RpcOrganizationIntegration = field(init=False)

    def __post_init__(self) -> None:
        """
        After initialization, we can fetch the integration and organization integration. so they're
        accessible as properties.
        """
        org_context = integration_service.organization_context(
            integration_id=self.integration_id,
            organization_id=self.organization_id,
        )
        if org_context.integration is None:
            raise NotificationTargetError("Invalid integration as target")

        if org_context.organization_integration is None:
            raise NotificationTargetError("Invalid organization for integration as target")

        self.integration = org_context.integration
        self.organization_integration = org_context.organization_integration
