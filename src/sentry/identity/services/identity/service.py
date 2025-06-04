# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import Any

from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.identity.services.identity import RpcIdentity, RpcIdentityProvider
from sentry.identity.services.identity.model import IdentityFilterArgs
from sentry.silo.base import SiloMode


class IdentityService(RpcService):
    key = "identity"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.identity.services.identity.impl import DatabaseBackedIdentityService

        return DatabaseBackedIdentityService()

    @rpc_method
    @abstractmethod
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

    @rpc_method
    @abstractmethod
    def get_identities(self, *, filter: IdentityFilterArgs) -> list[RpcIdentity]:
        """
        Returns a list of RpcIdentity based on the given filters.
        """

    @rpc_method
    @abstractmethod
    def get_identity(self, *, filter: IdentityFilterArgs) -> RpcIdentity | None:
        """
        Returns the first RpcIdentity based on the given filters.
        """

    @rpc_method
    @abstractmethod
    def get_user_identities_by_provider_type(
        self,
        *,
        user_id: int,
        provider_type: str,
        exclude_matching_external_ids: bool = False,
    ) -> list[RpcIdentity]:
        """
        Returns a list of APIIdentities for a given user based on idp.type (provider_type).
        If exclude_matching_external_ids is True, excludes entries with
        identity.external_id == idp.external_id
        """

    @rpc_method
    @abstractmethod
    def delete_identities(self, user_id: int, organization_id: int) -> None:
        """
        Deletes the set of identities associated with a user and organization context.
        :param user_id:
        :param organization_id:
        :return:
        """

    @rpc_method
    @abstractmethod
    def update_data(self, *, identity_id: int, data: Any) -> RpcIdentity | None:
        """
        Updates an Identity's data.
        :param identity_id:
        :return: RpcIdentity
        """


identity_service = IdentityService.create_delegation()
