from __future__ import annotations

from abc import abstractmethod
from typing import List, cast

from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.services.hybrid_cloud.usersocialauth.model import (
    RpcUserSocialAuth,
    UserSocialAuthFilterArgs,
)
from sentry.silo.base import SiloMode


class UserSocialAuthService(RpcService):
    key = "usersocialauth"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.usersocialauth.impl import (
            DatabaseBackedUserSocialAuthService,
        )

        return DatabaseBackedUserSocialAuthService()

    @rpc_method
    @abstractmethod
    def get_auths(self, *, filter: UserSocialAuthFilterArgs) -> List[RpcUserSocialAuth]:
        """
        Returns a list of RpcUserSocialAuth based on the given filters.
        """
        pass

    @rpc_method
    @abstractmethod
    def get_auth(self, *, filter: UserSocialAuthFilterArgs) -> RpcUserSocialAuth | None:
        """
        Returns the first RpcUserSocialAuth based on the given filters.
        """
        pass


usersocialauth_service: UserSocialAuthService = cast(
    UserSocialAuthService, UserSocialAuthService.create_delegation()
)
