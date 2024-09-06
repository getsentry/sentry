# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod

from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.silo.base import SiloMode
from sentry.users.services.lost_password_hash import RpcLostPasswordHash


class LostPasswordHashService(RpcService):
    key = "lost_password_hash"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.users.services.lost_password_hash.impl import DatabaseLostPasswordHashService

        return DatabaseLostPasswordHashService()

    # TODO: Denormalize this scim enabled flag onto organizations?
    # This is potentially a large list
    @rpc_method
    @abstractmethod
    def get_or_create(
        self,
        *,
        user_id: int,
    ) -> RpcLostPasswordHash:
        """
        This method returns a valid RpcLostPasswordHash for a user
        :return:
        """


lost_password_hash_service = LostPasswordHashService.create_delegation()
