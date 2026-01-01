import hashlib
from datetime import timedelta
from unittest import mock

import pytest
from django.utils import timezone

from sentry.conf.server import SENTRY_SCOPE_HIERARCHY_MAPPING, SENTRY_SCOPES
from sentry.hybridcloud.models import ApiTokenReplica
from sentry.models.apitoken import ApiToken, NotSupported, PlaintextSecretAlreadyRead
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.models.sentry_app_installation_token import SentryAppInstallationToken
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.types.token import AuthTokenType


@control_silo_test
class ApiTokenTest(TestCase):
    def test_is_expired(self) -> None:
        token = ApiToken(expires_at=None)
        assert not token.is_expired()

        token = ApiToken(expires_at=timezone.now() + timedelta(days=1))
        assert not token.is_expired()

        token = ApiToken(expires_at=timezone.now() - timedelta(days=1))
        assert token.is_expired()

    def test_get_scopes(self) -> None:
        token = ApiToken(scopes=1)
        assert token.get_scopes() == ["project:read"]

        token = ApiToken(scopes=4, scope_list=["project:read"])
        assert token.get_scopes() == ["project:read"]

        token = ApiToken(scope_list=["project:read"])
        assert token.get_scopes() == ["project:read"]

    def test_enforces_scope_hierarchy(self) -> None:
        user = self.create_user()

        # Ensure hierarchy is enforced for all tokens
        for scope in SENTRY_SCOPES:
            token = ApiToken.objects.create(
                user_id=user.id,
                scope_list=[scope],
            )
            assert set(token.get_scopes()) == SENTRY_SCOPE_HIERARCHY_MAPPING[scope]

    def test_organization_id_for_non_internal(self) -> None:
        install = self.create_sentry_app_installation()
        token = install.api_token
        org_id = token.organization_id

        with assume_test_silo_mode(SiloMode.REGION):
            assert ApiTokenReplica.objects.get(apitoken_id=token.id).organization_id == org_id

        with outbox_runner():
            install.delete()

        with assume_test_silo_mode(SiloMode.REGION):
            assert ApiTokenReplica.objects.get(apitoken_id=token.id).organization_id is None
        assert token.organization_id is None

    def test_last_chars_are_set(self) -> None:
        user = self.create_user()
        token = ApiToken.objects.create(user_id=user.id)
        assert token.token_last_characters == token.token[-4:]

    def test_hash_exists_on_token(self) -> None:
        user = self.create_user()
        token = ApiToken.objects.create(user_id=user.id)
        assert token.hashed_token is not None
        assert token.hashed_refresh_token is not None

    def test_hash_exists_on_user_token(self) -> None:
        user = self.create_user()
        token = ApiToken.objects.create(user_id=user.id, token_type=AuthTokenType.USER)
        assert token.hashed_token is not None
        assert len(token.hashed_token) == 64  # sha256 hash
        assert token.hashed_refresh_token is None  # user auth tokens don't have refresh tokens

    def test_plaintext_values_only_available_immediately_after_create(self) -> None:
        user = self.create_user()
        token = ApiToken.objects.create(user_id=user.id)
        assert token.plaintext_token is not None
        assert token.plaintext_refresh_token is not None

        # we accessed the tokens above when we asserted it was not None
        # accessing them again should throw an exception
        with pytest.raises(PlaintextSecretAlreadyRead):
            _ = token.plaintext_token

        with pytest.raises(PlaintextSecretAlreadyRead):
            _ = token.plaintext_refresh_token

    def test_error_when_accessing_refresh_token_on_user_token(self) -> None:
        user = self.create_user()
        token = ApiToken.objects.create(user_id=user.id, token_type=AuthTokenType.USER)

        with pytest.raises(NotSupported):
            assert token.plaintext_refresh_token is not None

    def test_user_auth_token_refresh_raises_error(self) -> None:
        user = self.create_user()
        token = ApiToken.objects.create(user_id=user.id, token_type=AuthTokenType.USER)

        with pytest.raises(NotSupported):
            token.refresh()

    def test_user_auth_token_sha256_hash(self) -> None:
        user = self.create_user()
        token = ApiToken.objects.create(user_id=user.id, token_type=AuthTokenType.USER)
        expected_hash = hashlib.sha256(token.plaintext_token.encode()).hexdigest()
        assert expected_hash == token.hashed_token

    def test_hash_updated_when_calling_update(self) -> None:
        user = self.create_user()
        token = ApiToken.objects.create(user_id=user.id)
        initial_expected_hash = hashlib.sha256(token.plaintext_token.encode()).hexdigest()
        assert initial_expected_hash == token.hashed_token

        new_token = "abc1234"
        new_token_expected_hash = hashlib.sha256(new_token.encode()).hexdigest()

        with assume_test_silo_mode(SiloMode.CONTROL):
            with outbox_runner():
                token.update(token=new_token)

        token.refresh_from_db()

        assert token.token_last_characters == "1234"
        assert token.hashed_token == new_token_expected_hash

    def test_default_string_serialization(self) -> None:
        user = self.create_user()
        token = ApiToken.objects.create(user_id=user.id)

        assert f"{token} is cool" == f"token_id={token.id} is cool"

    def test_replica_string_serialization(self) -> None:
        user = self.create_user()
        token = ApiToken.objects.create(user_id=user.id)
        with assume_test_silo_mode(SiloMode.REGION):
            replica = ApiTokenReplica.objects.get(apitoken_id=token.id)
            assert (
                f"{replica} is swug"
                == f"replica_token_id={replica.id}, token_id={token.id} is swug"
            )

    def test_delete_token_removes_replica(self) -> None:
        user = self.create_user()

        with outbox_runner():
            token = ApiToken.objects.create(user_id=user.id, token_type=AuthTokenType.USER)
            token.save()

        # Verify replica exists
        with assume_test_silo_mode(SiloMode.REGION):
            assert ApiTokenReplica.objects.filter(apitoken_id=token.id).exists()

        # Delete token and verify replica is removed
        with outbox_runner():
            token.delete()

        with assume_test_silo_mode(SiloMode.REGION):
            assert not ApiTokenReplica.objects.filter(apitoken_id=token.id).exists()

    @mock.patch(
        "sentry.hybridcloud.services.replica.region_replica_service.delete_replicated_api_token"
    )
    def test_handle_async_deletion_called(self, mock_delete_replica: mock.MagicMock) -> None:
        user = self.create_user()
        token = ApiToken.objects.create(user_id=user.id, token_type=AuthTokenType.USER)
        token_id = token.id

        # Delete token and verify handle_async_deletion was called
        with outbox_runner():
            token.delete()

        mock_delete_replica.assert_called_once_with(
            apitoken_id=token_id,
            region_name=mock.ANY,
        )

    def test_outboxes_for_update_uses_token_id_as_shard_identifier(self) -> None:
        """Verify ApiToken uses token.id (not user_id) for outbox sharding.

        This prevents lock contention for Sentry App tokens where all
        installations share the same proxy_user_id.
        """
        user = self.create_user()
        token = ApiToken.objects.create(user_id=user.id)

        outboxes = token.outboxes_for_update()
        assert len(outboxes) > 0

        for outbox in outboxes:
            # shard_identifier should be token.id, NOT user.id
            assert outbox.shard_identifier == token.id
            assert outbox.shard_identifier != user.id

    def test_outboxes_for_update_sentry_app_tokens_use_different_shards(self) -> None:
        """Verify that tokens for different Sentry App installations get different shards,
        even though they share the same proxy_user_id.

        This is the core fix for the lock contention issue described in #105425.
        """
        # Create a Sentry App with proxy user
        sentry_app = self.create_sentry_app(name="Test App", organization=self.organization)
        proxy_user = sentry_app.proxy_user

        # Create tokens for the same proxy_user (simulating different installations)
        token1 = ApiToken.objects.create(
            user=proxy_user,
            application=sentry_app.application,
        )
        token2 = ApiToken.objects.create(
            user=proxy_user,
            application=sentry_app.application,
        )

        # Get outboxes for both tokens
        outboxes1 = token1.outboxes_for_update()
        outboxes2 = token2.outboxes_for_update()

        assert len(outboxes1) > 0
        assert len(outboxes2) > 0

        # Verify they use different shards (token.id, not proxy_user.id)
        assert outboxes1[0].shard_identifier == token1.id
        assert outboxes2[0].shard_identifier == token2.id
        assert outboxes1[0].shard_identifier != outboxes2[0].shard_identifier
        assert outboxes1[0].shard_identifier != proxy_user.id
        assert outboxes2[0].shard_identifier != proxy_user.id

    def test_outboxes_for_update_respects_explicit_shard_identifier(self) -> None:
        """Verify that passing an explicit shard_identifier still works."""
        user = self.create_user()
        token = ApiToken.objects.create(user_id=user.id)

        custom_shard_id = 99999
        outboxes = token.outboxes_for_update(shard_identifier=custom_shard_id)

        assert len(outboxes) > 0
        for outbox in outboxes:
            assert outbox.shard_identifier == custom_shard_id


@control_silo_test
class ApiTokenInternalIntegrationTest(TestCase):
    def setUp(self) -> None:
        self.user = self.create_user()
        self.proxy = self.create_user()
        self.org = self.create_organization()
        self.internal_app = self.create_internal_integration(
            name="Internal App",
            organization=self.org,
        )
        self.install = SentryAppInstallation.objects.get(sentry_app=self.internal_app)

    def test_multiple_tokens_have_correct_organization_id(self) -> None:
        # First token is no longer created automatically with the application, so we must manually
        # create multiple tokens that aren't directly linked from the SentryAppInstallation model.
        token_1 = self.create_internal_integration_token(install=self.install, user=self.user)
        token_2 = self.create_internal_integration_token(install=self.install, user=self.user)

        assert token_1.organization_id == self.org.id
        assert token_2.organization_id == self.org.id

        with assume_test_silo_mode(SiloMode.REGION):
            assert (
                ApiTokenReplica.objects.get(apitoken_id=token_1.id).organization_id == self.org.id
            )
            assert (
                ApiTokenReplica.objects.get(apitoken_id=token_2.id).organization_id == self.org.id
            )

        with outbox_runner():
            for install_token in SentryAppInstallationToken.objects.all():
                install_token.delete()

        with assume_test_silo_mode(SiloMode.REGION):
            assert ApiTokenReplica.objects.get(apitoken_id=token_1.id).organization_id is None
            assert ApiTokenReplica.objects.get(apitoken_id=token_2.id).organization_id is None
