from __future__ import annotations

from datetime import datetime, timedelta

from django.utils import timezone

from sentry.tasks.auth.cleanup_pending_users import cleanup_pending_users
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.pending_user import PendingUser


@control_silo_test
class CleanupPendingUsersTest(TestCase):
    def _create_pending_user(self, email: str, expires_at: datetime) -> PendingUser:
        return PendingUser.objects.create(
            email=email,
            name="Test",
            password="pbkdf2_sha256$fake$hash",
            expires_at=expires_at,
        )

    def test_deletes_expired_records(self) -> None:
        expired = self._create_pending_user(
            "expired@example.com", expires_at=timezone.now() - timedelta(minutes=1)
        )
        cleanup_pending_users()
        assert not PendingUser.objects.filter(id=expired.id).exists()

    def test_does_not_delete_unexpired_records(self) -> None:
        active = self._create_pending_user(
            "active@example.com", expires_at=timezone.now() + timedelta(hours=1)
        )
        cleanup_pending_users()
        assert PendingUser.objects.filter(id=active.id).exists()
