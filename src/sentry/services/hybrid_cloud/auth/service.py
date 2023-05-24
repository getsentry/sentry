# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc
from typing import List, Optional, cast

from sentry.services.hybrid_cloud.auth import (
    AuthenticatedToken,
    AuthenticationContext,
    AuthenticationRequest,
    MiddlewareAuthenticationResponse,
    RpcAuthenticatorType,
    RpcAuthProvider,
    RpcAuthState,
    RpcOrganizationAuthConfig,
)
from sentry.services.hybrid_cloud.organization import RpcOrganizationMemberSummary
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.silo import SiloMode


class AuthService(RpcService):
    key = "auth"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.auth.impl import DatabaseBackedAuthService

        return DatabaseBackedAuthService()

    @rpc_method
    @abc.abstractmethod
    def authenticate(self, *, request: AuthenticationRequest) -> MiddlewareAuthenticationResponse:
        pass

    @rpc_method
    @abc.abstractmethod
    def authenticate_with(
        self, *, request: AuthenticationRequest, authenticator_types: List[RpcAuthenticatorType]
    ) -> AuthenticationContext:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_org_auth_config(
        self, *, organization_ids: List[int]
    ) -> List[RpcOrganizationAuthConfig]:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_user_auth_state(
        self,
        *,
        user_id: int,
        is_superuser: bool,
        organization_id: Optional[int],
        org_member: Optional[RpcOrganizationMemberSummary],
    ) -> RpcAuthState:
        pass

    # TODO: Denormalize this scim enabled flag onto organizations?
    # This is potentially a large list
    @rpc_method
    @abc.abstractmethod
    def get_org_ids_with_scim(self) -> List[int]:
        """
        This method returns a list of org ids that have scim enabled
        :return:
        """
        pass

    @rpc_method
    @abc.abstractmethod
    def get_auth_providers(self, *, organization_id: int) -> List[RpcAuthProvider]:
        """
        This method returns a list of auth providers for an org
        :return:
        """
        pass

    @rpc_method
    @abc.abstractmethod
    def token_has_org_access(self, *, token: AuthenticatedToken, organization_id: int) -> bool:
        pass


auth_service: AuthService = cast(AuthService, AuthService.create_delegation())
