from datetime import UTC, datetime, timedelta
from unittest import TestCase, mock

from sentry.integrations.credentials_service.types import CredentialLeasable, CredentialLease
from sentry.testutils.helpers.datetime import freeze_time


class MockClass(CredentialLeasable):
    def get_maximum_lease_duration_seconds(self) -> int:
        return 3600

    def _refresh_access_token_with_minimum_validity_time(
        self, token_minimum_validity_time: timedelta
    ) -> CredentialLease:
        return CredentialLease(
            access_token="access_token",
            expires_at=datetime.now(UTC) + timedelta(hours=1),
            permissions=None,
        )

    def _force_refresh_access_token(self) -> CredentialLease:
        return CredentialLease(
            access_token="access_token",
            expires_at=datetime.now(UTC) + timedelta(hours=1),
            permissions=None,
        )

    def _get_active_access_token(self) -> CredentialLease:
        return CredentialLease(
            access_token="access_token",
            expires_at=datetime.now(UTC) + timedelta(hours=1),
            permissions=None,
        )

    def get_current_access_token_expiration(self) -> datetime | None:
        raise NotImplementedError


class CredentialsLeasableTest(TestCase):
    def setUp(self) -> None:
        self.mock_class = MockClass()
        self.patcher = mock.patch.object(
            self.mock_class, "get_current_access_token_expiration", return_value=None
        )
        self.mock_get_expiration = self.patcher.start()

    def tearDown(self) -> None:
        self.patcher.stop()

    def test_does_access_token_expire_within__no_expiry(self) -> None:
        self.mock_get_expiration.return_value = None
        assert self.mock_class.does_access_token_expire_within(timedelta(hours=1)) is True

    @freeze_time("2025-01-01T12:00:00Z")
    def test_does_access_token_expire_within__already_expired(self) -> None:
        # Token just expired, any positive timedelta should return True
        self.mock_get_expiration.return_value = datetime(2025, 1, 1, 12, 0, 0, tzinfo=UTC)
        assert self.mock_class.does_access_token_expire_within(timedelta(seconds=1)) is True

        self.mock_get_expiration.return_value = datetime(2025, 1, 1, 11, 59, 0, tzinfo=UTC)
        assert self.mock_class.does_access_token_expire_within(timedelta(seconds=2)) is True

    @freeze_time("2025-01-01T12:00:00Z")
    def test_does_access_token_expire_within__under_expiry(self) -> None:
        # Token expires in 1 minute, check boundaries around this
        self.mock_get_expiration.return_value = datetime(2025, 1, 1, 12, 0, 1, tzinfo=UTC)
        assert self.mock_class.does_access_token_expire_within(timedelta(seconds=1)) is False
        assert self.mock_class.does_access_token_expire_within(timedelta(seconds=2)) is True
