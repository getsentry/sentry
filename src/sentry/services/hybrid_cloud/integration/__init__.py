from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Sequence

from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.silo import SiloMode


@dataclass(frozen=True)
class APIIntegration:
    id: int
    provider: str
    external_id: str
    name: str
    metadata: Mapping[str, Any]


@dataclass(frozen=True)
class APIOrganizationIntegration:
    id: int
    organization_id: int
    integration_id: int
    config: Mapping[str, Any]


class IntegrationService(InterfaceWithLifecycle):
    @abstractmethod
    def get_many(
        self, *, integration_ids: Iterable[int] | None = None, organization_id: int | None = None
    ):
        pass

    @abstractmethod
    def get_by_provider_id(self, provider: str, external_id: str) -> APIIntegration | None:
        pass

    @abstractmethod
    def get_organization_integrations(
        self, integration_id: int
    ) -> Sequence[APIOrganizationIntegration]:
        pass


def impl_with_db() -> IntegrationService:
    from sentry.services.hybrid_cloud.integration.impl import DatabaseBackedIntegrationService

    return DatabaseBackedIntegrationService()


integration_service: IntegrationService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_with_db,
        SiloMode.REGION: stubbed(impl_with_db, SiloMode.CONTROL),
        SiloMode.CONTROL: impl_with_db,
    }
)
