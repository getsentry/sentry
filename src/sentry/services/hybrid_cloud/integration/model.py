# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from datetime import datetime
from typing import Any, Dict, Optional

from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationProvider
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

    def get_provider(self) -> IntegrationProvider:
        from sentry import integrations

        return integrations.get(self.provider)  # type: ignore

    def get_status_display(self) -> str:
        for status_id, display in ObjectStatus.as_choices():
            if status_id == self.status:
                return display
        return "disabled"


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
