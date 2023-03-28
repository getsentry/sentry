# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from dataclasses import dataclass
from typing import List, Optional

from sentry.models.identity import Identity, IdentityProvider
from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.silo import SiloMode


@dataclass(frozen=True)
class RpcIdentityProvider:
    id: int
    type: str
    external_id: str


@dataclass(frozen=True)
class RpcIdentity:
    id: int
    idp_id: int
    user_id: int
    external_id: str


class IdentityService(InterfaceWithLifecycle):
    def _serialize_identity_provider(
        self, identity_provider: IdentityProvider
    ) -> RpcIdentityProvider:
        return RpcIdentityProvider(
            id=identity_provider.id,
            type=identity_provider.type,
            external_id=identity_provider.external_id,
        )

    def _serialize_identity(self, identity: Identity) -> RpcIdentity:
        return RpcIdentity(
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
    ) -> Optional[RpcIdentityProvider]:
        """
        Returns an RpcIdentityProvider either by using the idp.id (provider_id), or a combination
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
    ) -> Optional[RpcIdentity]:
        """
        Returns an RpcIdentity using the idp.id (provider_id) and either the user.id (user_id)
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
    ) -> List[RpcIdentity]:
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
