from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass
from typing import Any, Mapping

from sentry.constants import ObjectStatus
from sentry.models.integrations import Integration
from sentry.services.hybrid_cloud import (
    CreateStubFromBase,
    InterfaceWithLifecycle,
    silo_mode_delegation,
)
from sentry.silo import SiloMode


@dataclass(frozen=True)
class APIIntegration(Integration):
    id: int
    provider: str
    external_id: str
    name: str
    metadata: Mapping[str, Any]
    status: ObjectStatus


class IntegrationService(InterfaceWithLifecycle):
    @abstractmethod
    def get_by_provider_id(self, provider: str, external_id: str) -> APIIntegration | None:
        pass


class DatabaseBackedIntegrationService(IntegrationService):
    def close(self) -> None:
        pass

    def get_by_provider_id(self, provider: str, external_id: str) -> APIIntegration | None:
        from sentry.models import Integration

        integration = Integration.objects.filter(provider=provider, external_id=external_id).first()

        if integration:
            return APIIntegration(
                id=integration.id,
                provider=integration.provider,
                external_id=integration.external_id,
                name=integration.name,
                status=integration.status,
                metadata=integration.metadata,
            )

        return None


StubIntegrationService = CreateStubFromBase(DatabaseBackedIntegrationService)


integration_service: IntegrationService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: lambda: DatabaseBackedIntegrationService(),
        SiloMode.REGION: lambda: StubIntegrationService(),
        SiloMode.CONTROL: lambda: DatabaseBackedIntegrationService(),
    }
)
