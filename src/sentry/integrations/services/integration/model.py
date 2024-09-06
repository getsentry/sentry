# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from datetime import datetime
from typing import Any

from sentry.constants import ObjectStatus
from sentry.hybridcloud.rpc import RpcModel
from sentry.identity.services.identity.model import RpcIdentity, RpcIdentityProvider
from sentry.integrations.base import (
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationProvider,
)
from sentry.users.services.user.model import RpcUser


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
        from sentry.integrations.models.utils import get_provider

        return get_provider(instance=self)

    def get_installation(self, organization_id: int, **kwargs: Any) -> IntegrationInstallation:
        from sentry.integrations.models.utils import get_installation

        return get_installation(instance=self, organization_id=organization_id, **kwargs)

    def has_feature(self, feature: IntegrationFeatures) -> bool:
        from sentry.integrations.models.utils import has_feature

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


class RpcOrganizationContext(RpcModel):
    integration: RpcIntegration | None
    organization_integration: RpcOrganizationIntegration | None


class RpcOrganizationContextList(RpcModel):
    integration: RpcIntegration | None
    organization_integrations: list[RpcOrganizationIntegration]
