import datetime
from abc import abstractmethod
from dataclasses import dataclass

from sentry.models import LostPasswordHash, LostPasswordHashMixin
from sentry.services.hybrid_cloud import (
    CreateStubFromBase,
    InterfaceWithLifecycle,
    silo_mode_delegation,
)
from sentry.silo import SiloMode


@dataclass(frozen=True)
class APILostPasswordHash(LostPasswordHashMixin):
    id: int = -1
    user_id: int = -1
    hash: str = ""
    date_added = datetime.datetime


class LostPasswordHashService(InterfaceWithLifecycle):
    # TODO: Denormalize this scim enabled flag onto organizations?
    # This is potentially a large list
    @abstractmethod
    def get_or_create(
        self,
        user_id,
    ) -> APILostPasswordHash:
        """
        This method returns a valid APILostPasswordHash for a user
        :return:
        """
        pass


class DatabaseLostPasswordHashService(LostPasswordHashService):
    def get_or_create(
        self,
        user_id,
    ) -> APILostPasswordHash:
        # NOTE(mattrobenolt): Some security people suggest we invalidate
        # existing password hashes, but this opens up the possibility
        # of a DoS vector where then password resets are continually
        # requested, thus preventing someone from actually resetting
        # their password.
        # See: https://github.com/getsentry/sentry/pull/17299
        password_hash, created = LostPasswordHash.objects.get_or_create(user_id=user_id)
        if not password_hash.is_valid():
            password_hash.date_added = datetime.timezone.now()
            password_hash.set_hash()
            password_hash.save()
        return password_hash

    def close(self):
        pass


StubUserOptionService = CreateStubFromBase(DatabaseLostPasswordHashService)

lost_password_hash_service: LostPasswordHashService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: DatabaseLostPasswordHashService,
        SiloMode.REGION: StubUserOptionService,
        SiloMode.CONTROL: DatabaseLostPasswordHashService,
    }
)
