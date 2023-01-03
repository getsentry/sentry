from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING, List

from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.silo import SiloMode

if TYPE_CHECKING:
    from sentry.models.identity import Identity, IdentityProvider


@dataclass(frozen=True)
class APIIdentityProvider:
    id: int
    type: str
    external_id: str


@dataclass(frozen=True)
class APIIdentity:
    id: int
    idp_id: int
    user_id: int
    external_id: str


class IdentityService(InterfaceWithLifecycle):
    def _serialize_identity_provider(
        self, identity_provider: IdentityProvider
    ) -> APIIdentityProvider:
        return APIIdentityProvider(
            id=identity_provider.id,
            type=identity_provider.type,
            external_id=identity_provider.external_id,
        )

    def _serialize_identity(self, identity: Identity) -> APIIdentity:
        return APIIdentity(
            id=identity.id,
            idp_id=identity.idp_id,
            user_id=identity.user_id,
            external_id=identity.external_id,
        )

    @abstractmethod
    def get_provider(
        self,
        *,
        provider_id: int | None = None,
        provider_type: str | None = None,
        provider_ext_id: str | None = None,
    ) -> APIIdentityProvider | None:
        """
        Returns an APIIdentityProvider either by using the idp.id (provider_id), or a combination
        of idp.type (provider_type) and idp.external_id (provider_ext_id)
        """
        pass

    @abstractmethod
    def get_identity(
        self,
        *,
        provider_id: int,
        user_id: int | None = None,
        identity_ext_id: str | None = None,
    ) -> APIIdentity | None:
        """
        Returns an APIIdentity using the idp.id (provider_id) and either the user.id (user_id)
        or identity.external_id (identity_ext_id)
        """
        pass

    @abstractmethod
    def get_user_identities_by_provider_type(
        self,
        *,
        user_id: int,
        provider_type: str,
        exclude_matching_external_ids: bool = False,
    ) -> List[APIIdentity]:
        """
        Returns a list of APIIdentities for a given user based on idp.type (provider_type).
        If exclude_matching_external_ids is True, excludes entries with
        identity.external_id == idp.external_id
        """
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
