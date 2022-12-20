from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass
from typing import Any, Mapping

from sentry.models.identity import Identity, IdentityProvider
from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.silo import SiloMode


@dataclass(frozen=True)
class APIIdentityProvider(IdentityProvider):
    type: str
    external_id: str


@dataclass(frozen=True)
class APIIdentity(Identity):
    idp_id: int
    user_id: int
    external_id: str
    data: Mapping[str, Any]


class IdentityService(InterfaceWithLifecycle):
    @abstractmethod
    def get_by_provider_ids(
        self, provider_type: str, provider_ext_id: str, identity_ext_id: str
    ) -> APIIdentity | None:
        pass


def impl_with_db() -> IdentityService:
    from sentry.services.hybrid_cloud.identity.impl import DatabaseBackedIdentityService

    return DatabaseBackedIdentityService()


identity_service: IdentityService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_with_db,
        SiloMode.REGION: stubbed(impl_with_db, SiloMode.CONTROL),
        SiloMode.CONTROL: impl_with_db,
    }
)
