import hashlib
from datetime import timedelta
from unittest import mock

import pytest
from django.db import router, transaction
from django.utils import timezone

from sentry.conf.server import SENTRY_SCOPE_HIERARCHY_MAPPING, SENTRY_SCOPES
from sentry.hybridcloud.models import ApiTokenReplica
from sentry.hybridcloud.models.outbox import ControlOutbox, outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.models.apitoken import ApiToken, NotSupported, PlaintextSecretAlreadyRead
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.models.sentry_app_installation_token import SentryAppInstallationToken
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.types.token import AuthTokenType
from sentry.users.models.user import User


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
        with outbox_runner():
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
        with outbox_runner():
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

    @override_options({"api-token-async-flush": True})
    def test_outboxes_created_with_default_flush_false(self) -> None:
        user = self.create_user()

        token = ApiToken.objects.create(user_id=user.id)

        outboxes = ControlOutbox.objects.filter(
            shard_scope=OutboxScope.API_TOKEN_SCOPE,
            shard_identifier=token.id,
            category=OutboxCategory.API_TOKEN_UPDATE,
            object_identifier=token.id,
        )
        assert outboxes.exists()
        assert outboxes.count() > 0

        with assume_test_silo_mode(SiloMode.REGION):
            assert not ApiTokenReplica.objects.filter(apitoken_id=token.id).exists()

    @override_options({"api-token-async-flush": True})
    def test_outboxes_created_on_update_with_async_flush(self) -> None:
        user = self.create_user()

        with outbox_runner():
            token = ApiToken.objects.create(user_id=user.id)

        updated_expires_at = timezone.now() + timedelta(days=30)
        token.update(expires_at=updated_expires_at)

        outboxes = ControlOutbox.objects.filter(
            shard_scope=OutboxScope.API_TOKEN_SCOPE,
            shard_identifier=token.id,
            category=OutboxCategory.API_TOKEN_UPDATE,
            object_identifier=token.id,
        )
        assert outboxes.exists()
        assert outboxes.count() > 0

        with assume_test_silo_mode(SiloMode.REGION):
            replica = ApiTokenReplica.objects.get(apitoken_id=token.id)
            assert replica.expires_at != updated_expires_at

    @override_options({"api-token-async-flush": True})
    def test_async_replication_creates_replica_after_processing(self) -> None:
        user = self.create_user()

        with self.tasks():
            token = ApiToken.objects.create(user_id=user.id)

        # Verify outboxes were processed (should be deleted after processing)
        remaining_outboxes = ControlOutbox.objects.filter(
            shard_scope=OutboxScope.API_TOKEN_SCOPE,
            shard_identifier=token.id,
            category=OutboxCategory.API_TOKEN_UPDATE,
            object_identifier=token.id,
        )
        assert not remaining_outboxes.exists()

        with assume_test_silo_mode(SiloMode.REGION):
            replica = ApiTokenReplica.objects.get(apitoken_id=token.id)
            assert replica.hashed_token == token.hashed_token
            assert replica.user_id == user.id

    @override_options({"api-token-async-flush": True})
    def test_async_replication_updates_existing_replica(self) -> None:
        user = self.create_user()
        initial_expires_at = timezone.now() + timedelta(days=1)
        updated_expires_at = timezone.now() + timedelta(days=30)

        with self.tasks():
            token = ApiToken.objects.create(user_id=user.id, expires_at=initial_expires_at)

        with assume_test_silo_mode(SiloMode.REGION):
            replica = ApiTokenReplica.objects.get(apitoken_id=token.id)
            assert replica.expires_at is not None
            assert abs((replica.expires_at - initial_expires_at).total_seconds()) < 1

        with self.tasks():
            token.update(expires_at=updated_expires_at)

        with assume_test_silo_mode(SiloMode.REGION):
            replica = ApiTokenReplica.objects.get(apitoken_id=token.id)
            assert replica.expires_at is not None
            assert abs((replica.expires_at - updated_expires_at).total_seconds()) < 1

    def convert_token_outboxes_to_user_scope(self, token_id: int, user: User) -> None:
        original_query = ControlOutbox.objects.filter(
            shard_scope=OutboxScope.API_TOKEN_SCOPE, shard_identifier=token_id
        )

        original_count = original_query.count()
        assert original_count > 0
        # Used to convert ApiTokenUpdate outboxes to the User-bound shard, to
        # simulate having in-flight outboxes when the resharding PR lands.
        #
        # Please never, ever do this in actual production code.
        original_query.update(shard_scope=OutboxScope.USER_SCOPE, shard_identifier=user.id)

        assert (
            ControlOutbox.objects.filter(
                shard_scope=OutboxScope.USER_SCOPE, shard_identifier=user.id
            ).count()
            == original_count
        )

    def test_old_outbox_shard_replica_is_processed_correctly(self) -> None:
        user = self.create_user()
        with outbox_runner():
            token = ApiToken.objects.create(user_id=user.id)

        expiration_base = timezone.now()
        with outbox_runner():
            with outbox_context(
                transaction.atomic(using=router.db_for_write(ControlOutbox)), flush=False
            ):
                token.update(expires_at=expiration_base + timedelta(days=30))
                self.convert_token_outboxes_to_user_scope(token.id, user)

        assert ControlOutbox.objects.filter().count() == 0

        with assume_test_silo_mode(SiloMode.REGION):
            token_replica = ApiTokenReplica.objects.get(apitoken_id=token.id)
            assert token_replica is not None
            assert token_replica.apitoken_id == token.id
            assert token_replica.user_id == user.id
            assert token_replica.expires_at == expiration_base + timedelta(days=30)

        with outbox_runner():
            with outbox_context(
                transaction.atomic(using=router.db_for_write(ControlOutbox)), flush=False
            ):
                token_id = token.id
                token.delete()
                self.convert_token_outboxes_to_user_scope(token_id, user)

        with assume_test_silo_mode(SiloMode.REGION):
            assert not ApiTokenReplica.objects.filter(apitoken_id=token.id).exists()

    def test_replication_with_old_and_new_outbox_shards(self) -> None:
        user = self.create_user()
        with outbox_runner():
            token = ApiToken.objects.create(user_id=user.id)
        token_id = token.id
        expiration_base = timezone.now()
        with outbox_runner():
            with outbox_context(
                transaction.atomic(using=router.db_for_write(ControlOutbox)), flush=False
            ):
                token.update(expires_at=expiration_base + timedelta(days=30))
                self.convert_token_outboxes_to_user_scope(token_id, user)

                token.update(expires_at=expiration_base + timedelta(days=60))
                new_outbox = ControlOutbox.objects.filter(
                    category=OutboxCategory.API_TOKEN_UPDATE,
                    object_identifier=token_id,
                )
                assert new_outbox.count() == 2

        with assume_test_silo_mode(SiloMode.REGION):
            assert ApiTokenReplica.objects.get(apitoken_id=token.id).expires_at is not None
            assert ApiTokenReplica.objects.get(
                apitoken_id=token.id
            ).expires_at == expiration_base + timedelta(days=60)

        assert ControlOutbox.objects.filter(category=OutboxCategory.API_TOKEN_UPDATE).count() == 0


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

    @override_options({"api-token-async-flush": True})
    @mock.patch("sentry.hybridcloud.tasks.deliver_from_outbox.drain_outbox_shards_control.delay")
    def test_async_replication_schedules_drain_task(self, mock_drain_task) -> None:
        user = self.create_user()

        token = ApiToken.objects.create(user_id=user.id)

        assert mock_drain_task.called
        call_args = mock_drain_task.call_args
        assert call_args.kwargs["outbox_name"] == "sentry.ControlOutbox"

        outboxes = ControlOutbox.objects.filter(
            shard_scope=OutboxScope.API_TOKEN_SCOPE,
            shard_identifier=token.id,
            category=OutboxCategory.API_TOKEN_UPDATE,
            object_identifier=token.id,
        )
        assert outboxes.exists()

        # Verify the task was called with the correct ID range
        outbox_ids = list(outboxes.values_list("id", flat=True))
        assert call_args.kwargs["outbox_identifier_low"] == min(outbox_ids)
        assert call_args.kwargs["outbox_identifier_hi"] == max(outbox_ids) + 1

    @override_options({"api-token-async-flush": True})
    def test_multiple_tokens_use_different_shards(self) -> None:
        """Verify that multiple tokens for the same user use different shards."""
        user = self.create_user()

        token1 = ApiToken.objects.create(user_id=user.id)
        token2 = ApiToken.objects.create(user_id=user.id)

        outboxes1 = ControlOutbox.objects.filter(
            shard_scope=OutboxScope.API_TOKEN_SCOPE,
            shard_identifier=token1.id,
            category=OutboxCategory.API_TOKEN_UPDATE,
            object_identifier=token1.id,
        )
        assert outboxes1.exists()

        outboxes2 = ControlOutbox.objects.filter(
            shard_scope=OutboxScope.API_TOKEN_SCOPE,
            shard_identifier=token2.id,
            category=OutboxCategory.API_TOKEN_UPDATE,
            object_identifier=token2.id,
        )
        assert outboxes2.exists()

        # Verify they use different shards (the key to parallelization)
        assert token1.id != token2.id
        assert outboxes1.first().shard_identifier != outboxes2.first().shard_identifier
