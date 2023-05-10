# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import List, Optional, cast

from sentry.services.hybrid_cloud.identity import RpcIdentity, RpcIdentityProvider
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.silo import SiloMode


class IdentityService(RpcService):
    key = "identity"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.identity.impl import DatabaseBackedIdentityService

        return DatabaseBackedIdentityService()

    @rpc_method
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

    @rpc_method
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

    @rpc_method
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

    @rpc_method
    @abstractmethod
    def delete_identities(self, user_id: int, organization_id: int) -> None:
        """
        Deletes the set of identities associated with a user and organization context.
        :param user_id:
        :param organization_id:
        :return:
        """
        pass


identity_service: IdentityService = cast(IdentityService, IdentityService.create_delegation())
