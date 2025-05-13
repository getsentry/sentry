from dataclasses import dataclass
from typing import Any

from sentry.integrations.services.integration.model import RpcIntegration
from sentry.platform_example.notification_provider import NotificationProviderNames
from sentry.platform_example.notification_types import ProviderResourceType


# Target Types
@dataclass
class NotificationTarget:
    resource_type: ProviderResourceType
    resource_value: str | int
    provider: NotificationProviderNames
    additional_data: dict[str, Any]


@dataclass
class NotificationIntegrationTarget(NotificationTarget):
    # By querying the integration installation, we can get the provider, integration ID, etc.
    organization_id: int
    integration_id: int

    @property
    def integration_installation(self) -> RpcIntegration:
        raise NotImplementedError("Subclasses must implement this method")
