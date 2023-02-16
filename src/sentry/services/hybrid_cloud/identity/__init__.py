from abc import abstractmethod
from typing import List, Optional

from sentry.models.identity import Identity, IdentityProvider
from sentry.services.hybrid_cloud import (
    InterfaceWithLifecycle,
    SiloDataInterface,
    silo_mode_delegation,
    stubbed,
)
from sentry.silo import SiloMode


class APIIdentityProvider(SiloDataInterface):
    id: int = -1
    type: str = ""
    external_id: str = ""


class APIIdentity(SiloDataInterface):
    id: int = -1
    idp_id: int = -1
    user_id: int = -1
    external_id: str = ""


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
        provider_id: Optional[int] = None,
        provider_type: Optional[str] = None,
        provider_ext_id: Optional[str] = None,
    ) -> Optional[APIIdentityProvider]:
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
        user_id: Optional[int] = None,
        identity_ext_id: Optional[str] = None,
    ) -> Optional[APIIdentity]:
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
