# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod

from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.silo.base import SiloMode
from sentry.users.services.usersocialauth.model import RpcUserSocialAuth, UserSocialAuthFilterArgs


class UserSocialAuthService(RpcService):
    key = "usersocialauth"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.users.services.usersocialauth.impl import DatabaseBackedUserSocialAuthService

        return DatabaseBackedUserSocialAuthService()

    @rpc_method
    @abstractmethod
    def get_many(self, *, filter: UserSocialAuthFilterArgs) -> list[RpcUserSocialAuth]:
        """
        Returns a list of RpcUserSocialAuth based on the given filters.
        """

    @rpc_method
    @abstractmethod
    def get_one_or_none(self, *, filter: UserSocialAuthFilterArgs) -> RpcUserSocialAuth | None:
        """
        Returns the first RpcUserSocialAuth based on the given filters.
        """

    @rpc_method
    @abstractmethod
    def revoke_token(
        self, *, filter: UserSocialAuthFilterArgs, drop_token: bool = True
    ) -> list[RpcUserSocialAuth]:
        """
        Calls UserSocialAuth.revoke_token() on all matching results, returning the modified RpcUserSocialAuths.
        """

    @rpc_method
    @abstractmethod
    def refresh_token(self, *, filter: UserSocialAuthFilterArgs) -> list[RpcUserSocialAuth]:
        """
        Calls UserSocialAuth.refresh_token() on all matching results, returning the modified RpcUserSocialAuths.
        """

    @rpc_method
    @abstractmethod
    def link_auth(self, *, usa: RpcUserSocialAuth, organization: RpcOrganization) -> bool:
        """
        Uses a UserSocialAuth to create/link an integration to an organization.
        Returns True if successful.
        """


usersocialauth_service = UserSocialAuthService.create_delegation()
