import datetime
from abc import abstractmethod
from dataclasses import dataclass, fields
from typing import cast

from sentry.models import LostPasswordHash
from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.silo import SiloMode


class LostPasswordHashService(InterfaceWithLifecycle):
    # TODO: Denormalize this scim enabled flag onto organizations?
    # This is potentially a large list
    @abstractmethod
    def get_or_create(
        self,
        user_id: int,
    ) -> "APILostPasswordHash":
        """
        This method returns a valid APILostPasswordHash for a user
        :return:
        """
        pass

    @classmethod
    def serialize_lostpasswordhash(cls, lph: LostPasswordHash) -> "APILostPasswordHash":
        args = {
            field.name: getattr(lph, field.name)
            for field in fields(APILostPasswordHash)
            if hasattr(lph, field.name)
        }
        return APILostPasswordHash(**args)


@dataclass(frozen=True)
class APILostPasswordHash:
    id: int = -1
    user_id: int = -1
    hash: str = ""
    date_added = datetime.datetime

    def get_absolute_url(self, mode: str = "recover") -> str:
        return cast(str, LostPasswordHash.get_lostpassword_url(self.user_id, self.hash, mode))


def impl_with_db() -> LostPasswordHashService:
    from sentry.services.hybrid_cloud.lost_password_hash.impl import DatabaseLostPasswordHashService

    return DatabaseLostPasswordHashService()


lost_password_hash_service: LostPasswordHashService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_with_db,
        SiloMode.REGION: stubbed(impl_with_db, SiloMode.CONTROL),
        SiloMode.CONTROL: impl_with_db,
    }
)
