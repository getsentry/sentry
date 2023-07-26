from typing import cast

from sentry.services.hybrid_cloud.rpc import RpcService
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


usersocialauth_service: UserSocialAuthService = cast(
    UserSocialAuthService, UserSocialAuthService.create_delegation()
)
