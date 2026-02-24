from unittest.mock import patch

from django.utils import timezone

from sentry.models.authidentity import AuthIdentity
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class AuthIdentityUpdateLoggingTest(TestCase):
    def setUp(self):
        super().setUp()
        self.auth_provider = self.create_auth_provider(
            organization_id=self.organization.id, provider="dummy"
        )
        self.auth_identity = self.create_auth_identity(
            auth_provider=self.auth_provider,
            user=self.user,
            ident="test-ident",
            data={"old": "value"},
        )

    @patch("sentry.models.authidentity.logger")
    def test_update_data_logs(self, mock_logger):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.auth_identity.update(data={"new": "value"})

        mock_logger.info.assert_called_once_with(
            "auth_identity.update",
            extra={
                "auth_identity_id": self.auth_identity.id,
                "auth_provider_id": self.auth_provider.id,
                "user_id": self.user.id,
                "changed_fields": ["data"],
            },
        )

    @patch("sentry.models.authidentity.logger")
    def test_update_ident_logs(self, mock_logger):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.auth_identity.update(ident="new-ident")

        mock_logger.info.assert_called_once_with(
            "auth_identity.update",
            extra={
                "auth_identity_id": self.auth_identity.id,
                "auth_provider_id": self.auth_provider.id,
                "user_id": self.user.id,
                "changed_fields": ["ident"],
            },
        )

    @patch("sentry.models.authidentity.logger")
    def test_update_user_id_logs_old_and_new(self, mock_logger):
        old_user_id = self.user.id
        new_user = self.create_user()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.auth_identity.update(user_id=new_user.id)

        mock_logger.info.assert_called_once_with(
            "auth_identity.update",
            extra={
                "auth_identity_id": self.auth_identity.id,
                "auth_provider_id": self.auth_provider.id,
                "user_id": old_user_id,
                "new_user_id": new_user.id,
                "changed_fields": ["user_id"],
            },
        )

    @patch("sentry.models.authidentity.logger")
    def test_update_timestamp_only_does_not_log(self, mock_logger):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.auth_identity.update(last_synced=timezone.now())

        mock_logger.info.assert_not_called()

    @patch("sentry.models.authidentity.logger")
    def test_update_mixed_meaningful_and_timestamp_logs(self, mock_logger):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.auth_identity.update(data={"refreshed": True}, last_synced=timezone.now())

        mock_logger.info.assert_called_once_with(
            "auth_identity.update",
            extra={
                "auth_identity_id": self.auth_identity.id,
                "auth_provider_id": self.auth_provider.id,
                "user_id": self.user.id,
                "changed_fields": ["data"],
            },
        )

    @patch("sentry.models.authidentity.logger")
    def test_update_returns_affected_count(self, mock_logger):
        with assume_test_silo_mode(SiloMode.CONTROL):
            result = self.auth_identity.update(data={"new": "value"})

        assert result == 1

    @patch("sentry.models.authidentity.logger")
    def test_delete_logs(self, mock_logger):
        identity_id = self.auth_identity.id
        provider_id = self.auth_provider.id
        user_id = self.user.id

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.auth_identity.delete()

        mock_logger.info.assert_called_once_with(
            "auth_identity.delete",
            extra={
                "auth_identity_id": identity_id,
                "auth_provider_id": provider_id,
                "user_id": user_id,
            },
        )
        assert not AuthIdentity.objects.filter(id=identity_id).exists()
