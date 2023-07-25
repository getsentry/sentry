# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from datetime import datetime
from typing import Any, Dict, Optional

from sentry.constants import ObjectStatus
from sentry.integrations.base import (
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationProvider,
)
from sentry.models.integrations.integration import HybridIntegrationUtility
from sentry.services.hybrid_cloud import RpcModel


class RpcIntegration(RpcModel):
    id: int
    provider: str
    external_id: str
    name: str
    metadata: Dict[str, Any]
    status: int

    def __hash__(self) -> int:
        return hash(self.id)

    def get_status_display(self) -> str:
        for status_id, display in ObjectStatus.as_choices():
            if status_id == self.status:
                return display
        return "disabled"

    def get_provider(self) -> IntegrationProvider:
        return HybridIntegrationUtility.get_provider(instance=self)

    def get_installation(self, organization_id: int, **kwargs: Any) -> IntegrationInstallation:
        return HybridIntegrationUtility.get_installation(
            instance=self, organization_id=organization_id, **kwargs
        )

    def has_feature(self, feature: IntegrationFeatures) -> bool:
        return HybridIntegrationUtility.has_feature(instance=self, feature=feature)


class RpcOrganizationIntegration(RpcModel):
    id: int
    default_auth_id: Optional[int]
    organization_id: int
    integration_id: int
    config: Dict[str, Any]
    status: int  # As ObjectStatus
    grace_period_end: Optional[datetime]

    def __hash__(self) -> int:
        return hash(self.id)

    def get_status_display(self) -> str:
        for status_id, display in ObjectStatus.as_choices():
            if status_id == self.status:
                return display
        return "disabled"


class RpcIntegrationExternalProject(RpcModel):
    id: int
    organization_integration_id: int
    date_added: datetime
    name: str
    external_id: str
    resolved_status: str
    unresolved_status: str
