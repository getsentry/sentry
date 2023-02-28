from __future__ import annotations

from dataclasses import dataclass
from typing import List, cast

from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
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


class IdentityService(RpcService):
    name = "identity"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.identity.impl import DatabaseBackedIdentityService

        return DatabaseBackedIdentityService()

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

    @rpc_method
    def get_provider(
        self,
        *,
        provider_id: int | None = None,
        provider_type: str | None = None,
        provider_ext_id: str | None = None,
    ) -> RpcIdentityProvider | None:
        """
        Returns an RpcIdentityProvider either by using the idp.id (provider_id), or a combination
        of idp.type (provider_type) and idp.external_id (provider_ext_id)
        """
        pass

    @rpc_method
    def get_identity(
        self,
        *,
        provider_id: int,
        user_id: int | None = None,
        identity_ext_id: str | None = None,
    ) -> RpcIdentity | None:
        """
        Returns an RpcIdentity using the idp.id (provider_id) and either the user.id (user_id)
        or identity.external_id (identity_ext_id)
        """
        pass

    @rpc_method
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


identity_service: IdentityService = cast(IdentityService, IdentityService.resolve_to_delegation())

from sentry.models.identity import Identity, IdentityProvider
