# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc
from datetime import timedelta
from typing import Any, FrozenSet, List, Mapping, Optional, Type, cast

from django.utils import timezone

from sentry.services.hybrid_cloud.auth import (
    AuthenticationContext,
    AuthenticationRequest,
    MiddlewareAuthenticationResponse,
    RpcApiKey,
    RpcAuthenticatorType,
    RpcAuthIdentity,
    RpcAuthProvider,
    RpcAuthState,
    RpcMemberSsoState,
    RpcOrganizationAuthConfig,
)
from sentry.services.hybrid_cloud.organization import RpcOrganizationMemberSummary
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.silo import SiloMode

_SSO_BYPASS = RpcMemberSsoState(is_required=False, is_valid=True)
_SSO_NONMEMBER = RpcMemberSsoState(is_required=False, is_valid=False)


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
    def get_auth_provider(self, *, organization_id: int) -> Optional[RpcAuthProvider]:
        """
        This method returns the auth provider for an org, if one exists
        """
        pass

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
    def get_organization_api_keys(self, *, organization_id: int) -> List[RpcApiKey]:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_organization_key(self, *, key: str) -> Optional[RpcApiKey]:
        pass

    @rpc_method
    @abc.abstractmethod
    def enable_partner_sso(
        self, *, organization_id: int, provider_key: str, provider_config: Mapping[str, Any]
    ) -> None:
        pass

    @rpc_method
    @abc.abstractmethod
    def create_auth_identity(
        self, *, provider: str, config: Mapping[str, Any], user_id: int, ident: str
    ) -> None:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_auth_provider_with_config(
        self, *, provider: str, config: Mapping[str, Any]
    ) -> Optional[RpcAuthProvider]:
        pass

    @abc.abstractmethod
    def get_auth_identity_for_user(
        self, auth_provider_id: int, user_id: int
    ) -> Optional[RpcAuthIdentity]:
        pass

    @abc.abstractmethod
    def can_override_sso_as_owner(
        self, auth_provider: RpcAuthProvider, member: RpcOrganizationMemberSummary
    ) -> bool:
        """If an owner is trying to gain access, allow bypassing SSO if there are no
        other owners with SSO enabled.
        """
        pass

    def auth_identity_is_valid(
        self, auth_identity: RpcAuthIdentity, member: RpcOrganizationMemberSummary
    ) -> bool:
        if member.flags.sso__invalid:
            return False
        if not member.flags.sso__linked:
            return False

        if not auth_identity.last_verified:
            return False
        if auth_identity.last_verified < timezone.now() - timedelta(hours=24):
            return False
        return True

    def query_sso_state(
        self,
        *,
        organization_id: Optional[int],
        is_super_user: bool,
        member: Optional[RpcOrganizationMemberSummary],
    ) -> RpcMemberSsoState:
        if organization_id is None:
            return _SSO_NONMEMBER

        # we special case superuser so that if they're a member of the org they must still follow SSO checks
        # or put another way, superusers who are not members of orgs bypass SSO.
        if member is None or member.user_id is None:
            if is_super_user:
                return _SSO_BYPASS
            return _SSO_NONMEMBER

        auth_provider = self.get_auth_provider(organization_id=organization_id)
        if auth_provider is None:
            return _SSO_BYPASS

        if auth_provider.flags.allow_unlinked:
            return _SSO_BYPASS
        else:
            requires_sso = True

            auth_identity = self.get_auth_identity_for_user(
                auth_provider_id=auth_provider.id, user_id=member.user_id
            )
            if auth_identity is None:
                sso_is_valid = False
                requires_sso = not self.can_override_sso_as_owner(auth_provider, member)
            else:
                sso_is_valid = self.auth_identity_is_valid(
                    auth_identity=auth_identity, member=member
                )

        return RpcMemberSsoState(is_required=requires_sso, is_valid=sso_is_valid)

    def get_user_auth_state(
        self,
        *,
        user_id: int,
        is_superuser: bool,
        organization_id: Optional[int],
        org_member: Optional[RpcOrganizationMemberSummary],
    ) -> RpcAuthState:
        sso_state = self.query_sso_state(
            organization_id=organization_id, is_super_user=is_superuser, member=org_member
        )

        if is_superuser:
            # "permissions" is a bit of a misnomer -- these are all admin level permissions, and the intent is that if you
            # have them, you can only use them when you are acting, as a superuser.  This is intentional.
            permissions = list(self.get_permissions_for_user(user_id))
        else:
            permissions = []

        return RpcAuthState(sso_state=sso_state, permissions=permissions)

    @abc.abstractmethod
    def get_permissions_for_user(self, user_id: int) -> FrozenSet[str]:
        pass


def _get_nonlocal_class() -> Type[RpcService]:
    from sentry.services.hybrid_cloud.auth.impl import RegionAuthService

    return RegionAuthService


auth_service: AuthService = cast(
    AuthService, AuthService.create_delegation(nonlocal_class=_get_nonlocal_class)
)
