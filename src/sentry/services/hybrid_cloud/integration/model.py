# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from datetime import datetime
from typing import Any

from sentry.constants import ObjectStatus
from sentry.integrations.base import (
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationProvider,
)
from sentry.services.hybrid_cloud import RpcModel
from sentry.services.hybrid_cloud.identity.model import RpcIdentity, RpcIdentityProvider
from sentry.services.hybrid_cloud.user.model import RpcUser


class RpcIntegration(RpcModel):
    id: int
    provider: str
    external_id: str
    name: str
    metadata: dict[str, Any]
    status: int

    def __hash__(self) -> int:
        return hash(self.id)

    def get_status_display(self) -> str:
        for status_id, display in ObjectStatus.as_choices():
            if status_id == self.status:
                return display
        return "disabled"

    def get_provider(self) -> IntegrationProvider:
        from sentry.models.integrations.utils import get_provider

        return get_provider(instance=self)

    def get_installation(self, organization_id: int, **kwargs: Any) -> IntegrationInstallation:
        from sentry.models.integrations.utils import get_installation

        return get_installation(instance=self, organization_id=organization_id, **kwargs)

    def has_feature(self, feature: IntegrationFeatures) -> bool:
        from sentry.models.integrations.utils import has_feature

        return has_feature(instance=self, feature=feature)


class RpcOrganizationIntegration(RpcModel):
    id: int
    default_auth_id: int | None
    organization_id: int
    integration_id: int
    config: dict[str, Any]
    status: int  # As ObjectStatus
    grace_period_end: datetime | None

    def __hash__(self) -> int:
        return hash(self.id)

    def get_status_display(self) -> str:
        for status_id, display in ObjectStatus.as_choices():
            if status_id == self.status:
                return display
        return "disabled"


class RpcOrganizationIntegrationContextResult(RpcModel):
    integration: RpcIntegration | None
    installs: list[RpcOrganizationIntegration]


class RpcIntegrationExternalProject(RpcModel):
    id: int
    organization_integration_id: int
    name: str
    external_id: str
    resolved_status: str
    unresolved_status: str


class RpcIntegrationIdentityContext(RpcModel):
    integration: RpcIntegration | None
    identity_provider: RpcIdentityProvider | None
    identity: RpcIdentity | None
    user: RpcUser | None
