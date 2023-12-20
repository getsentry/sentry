# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import Any, List, Optional

from sentry.services.hybrid_cloud.identity import RpcIdentity, RpcIdentityProvider
from sentry.services.hybrid_cloud.identity.model import IdentityFilterArgs
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
    def get_identities(self, *, filter: IdentityFilterArgs) -> List[RpcIdentity]:
        """
        Returns a list of RpcIdentity based on the given filters.
        """
        pass

    @rpc_method
    @abstractmethod
    def get_identity(self, *, filter: IdentityFilterArgs) -> Optional[RpcIdentity]:
        """
        Returns the first RpcIdentity based on the given filters.
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

    @rpc_method
    @abstractmethod
    def update_data(self, *, identity_id: int, data: Any) -> Optional[RpcIdentity]:
        """
        Updates an Identity's data.
        :param identity_id:
        :return: RpcIdentity
        """
        pass


identity_service = IdentityService.create_delegation()
