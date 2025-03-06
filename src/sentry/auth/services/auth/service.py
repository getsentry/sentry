# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc
from collections.abc import Mapping
from typing import Any

from sentry.auth.services.auth import RpcApiKey, RpcAuthProvider, RpcOrganizationAuthConfig
from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.silo.base import SiloMode


class AuthService(RpcService):
    key = "auth"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.auth.services.auth.impl import DatabaseBackedAuthService

        return DatabaseBackedAuthService()

    @rpc_method
    @abc.abstractmethod
    def get_org_auth_config(
        self, *, organization_ids: list[int]
    ) -> list[RpcOrganizationAuthConfig]:
        pass

    # TODO: Denormalize this scim enabled flag onto organizations?
    # This is potentially a large list
    @rpc_method
    @abc.abstractmethod
    def get_org_ids_with_scim(self) -> list[int]:
        """
        This method returns a list of org ids that have scim enabled
        :return:
        """

    @rpc_method
    @abc.abstractmethod
    def get_auth_provider(self, *, organization_id: int) -> RpcAuthProvider | None:
        """
        This method returns the auth provider for an org, if one exists
        """

    @rpc_method
    @abc.abstractmethod
    def disable_provider(self, *, provider_id: int) -> None:
        pass

    @rpc_method
    @abc.abstractmethod
    def change_scim(
        self, *, user_id: int, provider_id: int, enabled: bool, allow_unlinked: bool
    ) -> None:
        pass

    @rpc_method
    @abc.abstractmethod
    def update_provider_config(
        self, organization_id: int, auth_provider_id: int, config: Mapping[str, Any]
    ) -> None:
        pass

    @rpc_method
    @abc.abstractmethod
    def update_provider(self, organization_id: int, auth_provider_id: int, provider: str) -> None:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_organization_api_keys(self, *, organization_id: int) -> list[RpcApiKey]:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_organization_key(self, *, key: str) -> RpcApiKey | None:
        pass

    @rpc_method
    @abc.abstractmethod
    def enable_partner_sso(
        self,
        *,
        organization_id: int,
        provider_key: str,
        provider_config: Mapping[str, Any],
        user_id: int | None = None,
        sender: str | None = None,
        equivalent_providers: list[str] | None = None,
    ) -> None:
        pass

    @rpc_method
    @abc.abstractmethod
    def create_auth_identity(
        self,
        *,
        provider: str,
        config: Mapping[str, Any],
        user_id: int,
        ident: str,
        equivalent_providers: list[str] | None = None,
    ) -> None:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_auth_provider_with_config(
        self, *, provider: str, config: Mapping[str, Any]
    ) -> RpcAuthProvider | None:
        pass


auth_service = AuthService.create_delegation()
