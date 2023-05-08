import datetime

from sentry.models import LostPasswordHash
from sentry.services.hybrid_cloud.lost_password_hash import (
    LostPasswordHashService,
    RpcLostPasswordHash,
)
from sentry.services.hybrid_cloud.lost_password_hash.serial import serialize_lostpasswordhash


class DatabaseLostPasswordHashService(LostPasswordHashService):
    def get_or_create(
        self,
        user_id: int,
    ) -> RpcLostPasswordHash:
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
        return serialize_lostpasswordhash(password_hash)

    def close(self) -> None:
        pass
