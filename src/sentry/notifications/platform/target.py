from dataclasses import dataclass
from enum import StrEnum
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
)


class NotificationTargetError(Exception):
    pass


INTEGRATION_PROVIDER_KEYS = [
    NotificationProviderKey.SLACK,
    NotificationProviderKey.DISCORD,
    NotificationProviderKey.MSTEAMS,
]


class NotificationTargetType(StrEnum):
    GENERIC = "generic"
    INTEGRATION = "integration"


class GenericNotificationTarget(NotificationTarget):
    """
    A designated recipient for a notification. This could be a user, a team, or a channel.
    Accepts the renderable object type that matches the connected provider.
    """

    pass


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


def serialize_target(target: NotificationTarget) -> dict[str, Any]:
    if isinstance(target, IntegrationNotificationTarget):
        return {"type": NotificationTargetType.INTEGRATION, "target": target.dict()}
    return {"type": NotificationTargetType.GENERIC, "target": target.dict()}


def deserialize_target(data: dict[str, Any]) -> NotificationTarget:
    target_type = data["type"]
    target_data = data["target"]
    if target_type == NotificationTargetType.INTEGRATION:
        return IntegrationNotificationTarget.parse_obj(target_data)
    elif target_type == NotificationTargetType.GENERIC:
        return GenericNotificationTarget.parse_obj(target_data)
    raise NotificationTargetError(f"Unknown target type: {target_type}")
