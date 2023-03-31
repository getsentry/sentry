# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

import datetime
from abc import abstractmethod
from typing import cast

from sentry.models import LostPasswordHash
from sentry.services.hybrid_cloud import RpcModel
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.silo import SiloMode


class LostPasswordHashService(RpcService):
    key = "lost_password_hash"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.lost_password_hash.impl import (
            DatabaseLostPasswordHashService,
        )

        return DatabaseLostPasswordHashService()

    # TODO: Denormalize this scim enabled flag onto organizations?
    # This is potentially a large list
    @rpc_method
    @abstractmethod
    def get_or_create(
        self,
        *,
        user_id: int,
    ) -> "RpcLostPasswordHash":
        """
        This method returns a valid RpcLostPasswordHash for a user
        :return:
        """
        pass

    @classmethod
    def serialize_lostpasswordhash(cls, lph: LostPasswordHash) -> "RpcLostPasswordHash":
        return cast(RpcLostPasswordHash, RpcLostPasswordHash.serialize_by_field_name(lph))


class RpcLostPasswordHash(RpcModel):
    id: int = -1
    user_id: int = -1
    hash: str = ""
    date_added = datetime.datetime

    def get_absolute_url(self, mode: str = "recover") -> str:
        return cast(str, LostPasswordHash.get_lostpassword_url(self.user_id, self.hash, mode))


lost_password_hash_service: LostPasswordHashService = cast(
    LostPasswordHashService, LostPasswordHashService.create_delegation()
)
