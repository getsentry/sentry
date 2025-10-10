from dataclasses import dataclass, field
from functools import cached_property
from typing import Any

from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.services.integration.model import (
    RpcIntegration,
    RpcOrganizationIntegration,
)
from sentry.integrations.services.integration.service import integration_service
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTarget,
    NotificationTargetResourceType,
)


class NotificationTargetError(Exception):
    pass


INTEGRATION_PROVIDER_KEYS = [
    NotificationProviderKey.SLACK,
    NotificationProviderKey.DISCORD,
    NotificationProviderKey.MSTEAMS,
]


@dataclass(kw_only=True, frozen=True)
class GenericNotificationTarget(NotificationTarget):
    """
    A designated recipient for a notification. This could be a user, a team, or a channel.
    Accepts the renderable object type that matches the connected provider.
    """

    is_prepared: bool = field(init=False, default=False)
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


@dataclass(kw_only=True, frozen=True)
class IntegrationNotificationTarget(GenericNotificationTarget):
    """
    Adds necessary properties and methods to designate a target within an integration.
    Accepts the renderable object type that matches the connected provider.
    """

    integration_id: int
    organization_id: int


@dataclass(kw_only=True, frozen=True)
class PreparedIntegrationNotificationTarget[IntegrationInstallationT: IntegrationInstallation]:
    target: IntegrationNotificationTarget
    installation_cls: type[IntegrationInstallationT]

    @cached_property
    def integration(self) -> RpcIntegration:
        integration = integration_service.get_integration(integration_id=self.target.integration_id)
        if integration is None:
            raise NotificationTargetError(f"Integration {self.target.integration_id} not found")
        return integration

    @cached_property
    def organization_integration(self) -> RpcOrganizationIntegration:
        organization_integration = integration_service.get_organization_integration(
            integration_id=self.target.integration_id,
            organization_id=self.target.organization_id,
        )

        if organization_integration is None:
            raise NotificationTargetError(
                f"Organization integration for integration {self.target.integration_id} and organization {self.target.organization_id} not found"
            )
        return organization_integration

    @cached_property
    def integration_installation(self) -> IntegrationInstallationT:
        return self.installation_cls(
            model=self.integration,
            organization_id=self.organization_integration.organization_id,
        )
