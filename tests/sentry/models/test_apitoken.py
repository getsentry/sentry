import hashlib
from datetime import timedelta

from django.utils import timezone

from sentry.conf.server import SENTRY_SCOPE_HIERARCHY_MAPPING, SENTRY_SCOPES
from sentry.hybridcloud.models import ApiTokenReplica
from sentry.models.apitoken import ApiToken
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.integrations.sentry_app_installation_token import SentryAppInstallationToken
from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.types.token import AuthTokenType


@control_silo_test
class ApiTokenTest(TestCase):
    def test_is_expired(self):
        token = ApiToken(expires_at=None)
        assert not token.is_expired()

        token = ApiToken(expires_at=timezone.now() + timedelta(days=1))
        assert not token.is_expired()

        token = ApiToken(expires_at=timezone.now() - timedelta(days=1))
        assert token.is_expired()

    def test_get_scopes(self):
        token = ApiToken(scopes=1)
        assert token.get_scopes() == ["project:read"]

        token = ApiToken(scopes=4, scope_list=["project:read"])
        assert token.get_scopes() == ["project:read"]

        token = ApiToken(scope_list=["project:read"])
        assert token.get_scopes() == ["project:read"]

    def test_enforces_scope_hierarchy(self):
        user = self.create_user()

        # Ensure hierarchy is enforced for all tokens
        for scope in SENTRY_SCOPES:
            token = ApiToken.objects.create(
                user_id=user.id,
                scope_list=[scope],
            )
            assert set(token.get_scopes()) == SENTRY_SCOPE_HIERARCHY_MAPPING[scope]

    def test_organization_id_for_non_internal(self):
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

    @override_options({"apitoken.auto-add-last-chars": True})
    def test_last_chars_are_set(self):
        user = self.create_user()
        token = ApiToken.objects.create(user_id=user.id)
        assert token.token_last_characters == token.token[-4:]

    @override_options({"apitoken.auto-add-last-chars": False})
    def test_last_chars_are_not_set(self):
        user = self.create_user()
        token = ApiToken.objects.create(user_id=user.id)
        assert token.token_last_characters is None

    @override_options({"apitoken.save-hash-on-create": True})
    def test_hash_exists_on_user_token(self):
        user = self.create_user()
        token = ApiToken.objects.create(user_id=user.id, token_type=AuthTokenType.USER)
        assert token.hashed_token is not None
        assert len(token.hashed_token) == 64  # sha256 hash
        assert token.hashed_refresh_token is None  # user auth tokens don't have refresh tokens

    @override_options({"apitoken.save-hash-on-create": False})
    def test_hash_does_not_exist_on_user_token_with_option_off(self):
        user = self.create_user()
        token = ApiToken.objects.create(user_id=user.id, token_type=AuthTokenType.USER)
        assert token.hashed_token is None
        assert token.hashed_refresh_token is None  # user auth tokens don't have refresh tokens

    @override_options({"apitoken.save-hash-on-create": True})
    def test_plaintext_values_only_available_immediately_after_create(self):
        user = self.create_user()
        token = ApiToken.objects.create(user_id=user.id, token_type=AuthTokenType.USER)
        assert token._plaintext_token is not None
        assert token._plaintext_refresh_token is None  # user auth tokens don't have refresh tokens

        _ = token._plaintext_token

        # we read the value above so now it should
        # now be None as it is a "read once" property
        assert token._plaintext_token is None

    @override_options({"apitoken.save-hash-on-create": True})
    def test_user_auth_token_hash(self):
        user = self.create_user()
        token = ApiToken.objects.create(user_id=user.id, token_type=AuthTokenType.USER)
        expected_hash = hashlib.sha256(token._plaintext_token.encode()).hexdigest()
        assert expected_hash == token.hashed_token


@control_silo_test
class ApiTokenInternalIntegrationTest(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.proxy = self.create_user()
        self.org = self.create_organization()
        self.internal_app = self.create_internal_integration(
            name="Internal App",
            organization=self.org,
        )
        self.install = SentryAppInstallation.objects.get(sentry_app=self.internal_app)

    def test_multiple_tokens_have_correct_organization_id(self):
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
