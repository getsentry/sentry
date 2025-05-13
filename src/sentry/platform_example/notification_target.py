from dataclasses import dataclass
from typing import Any

from jsonschema import validate

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.platform_example.notification_provider import NotificationProviderNames
from sentry.platform_example.notification_types import ProviderResourceType
from sentry.platform_example.registry import ProviderRegistry


# Target Types
@dataclass
class NotificationTarget:
    resource_type: ProviderResourceType
    resource_value: str | int
    provider: NotificationProviderNames
    additional_data: dict[str, Any]


class InvalidNotificationTargetError(Exception):
    pass


@dataclass
class NotificationIntegrationTarget(NotificationTarget):
    # By querying the integration installation, we can get the provider, integration ID, etc.
    organization_id: int
    integration_id: int


class NotificationIntegrationTargetValidator:
    target: NotificationIntegrationTarget

    def __init__(self, target: NotificationTarget):
        if not isinstance(target, NotificationIntegrationTarget):
            raise InvalidNotificationTargetError("Target is not a NotificationIntegrationTarget")

        self.target = target

    def validate_notification_target(self):
        if not self.target.organization_id:
            raise InvalidNotificationTargetError("Organization ID is not valid")

        if not self.target.integration_id:
            raise InvalidNotificationTargetError("Integration ID is not valid")

        provider = ProviderRegistry.get_provider(self.target.provider)
        if not provider:
            raise InvalidNotificationTargetError(f"Provider {self.target.provider} not found")

        if self.target.additional_data:
            schema = provider.get_additional_data_schema()
            if schema:
                validate(self.target.additional_data, schema)

    def get_integration_installation(self):
        integration = integration_service.get_integration(
            integration_id=self.target.integration_id,
            status=ObjectStatus.ACTIVE,
        )
        if integration is None:
            raise InvalidNotificationTargetError(f"Integration not found for target: {self.target}")

        install_class = integration.get_installation(organization_id=self.target.organization_id)
        installation = install_class.org_integration

        if installation is None:
            raise InvalidNotificationTargetError(
                f"Integration installation not found for target: {self.target}"
            )

        return installation
