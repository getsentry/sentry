import datetime
from abc import abstractmethod
from dataclasses import dataclass, fields

from sentry.models import LostPasswordHash
from sentry.services.hybrid_cloud import (
    CreateStubFromBase,
    InterfaceWithLifecycle,
    silo_mode_delegation,
)
from sentry.silo import SiloMode


@dataclass(frozen=True)
class APILostPasswordHash:  # type: ignore[misc]
    id: int = -1
    user_id: int = -1
    hash: str = ""
    date_added = datetime.datetime

    # Duplicated from LostPasswordHash
    def get_absolute_url(self, mode: str = "recover") -> str:
        return LostPasswordHash.get_lostpassword_url(self.user_id, self.hash, mode)


class LostPasswordHashService(InterfaceWithLifecycle):
    # TODO: Denormalize this scim enabled flag onto organizations?
    # This is potentially a large list
    @abstractmethod
    def get_or_create(
        self,
        user_id: int,
    ) -> APILostPasswordHash:
        """
        This method returns a valid APILostPasswordHash for a user
        :return:
        """
        pass

    @classmethod
    def serialize_lostpasswordhash(cls, lph: LostPasswordHash) -> APILostPasswordHash:
        args = {
            field.name: getattr(lph, field.name)
            for field in fields(APILostPasswordHash)
            if hasattr(lph, field.name)
        }
        return APILostPasswordHash(**args)


class DatabaseLostPasswordHashService(LostPasswordHashService):
    def get_or_create(
        self,
        user_id: int,
    ) -> APILostPasswordHash:
        # NOTE(mattrobenolt): Some security people suggest we invalidate
        # existing password hashes, but this opens up the possibility
        # of a DoS vector where then password resets are continually
        # requested, thus preventing someone from actually resetting
        # their password.
        # See: https://github.com/getsentry/sentry/pull/17299
        password_hash, created = LostPasswordHash.objects.get_or_create(user_id=user_id)
        if not password_hash.is_valid():
            password_hash.date_added = datetime.datetime.now()
            password_hash.set_hash()
            password_hash.save()
        return self.serialize_lostpasswordhash(password_hash)

    def close(self) -> None:
        pass


StubUserOptionService = CreateStubFromBase(DatabaseLostPasswordHashService)

lost_password_hash_service: LostPasswordHashService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: lambda: DatabaseLostPasswordHashService(),
        SiloMode.REGION: lambda: StubUserOptionService(),
        SiloMode.CONTROL: lambda: DatabaseLostPasswordHashService(),
    }
)
