from sentry.models.apiapplication import ApiApplication
from sentry.models.apitoken import ApiToken
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.models.sentry_app_installation_for_provider import (
    SentryAppInstallationForProvider,
)
from sentry.sentry_apps.models.sentry_app_installation_token import SentryAppInstallationToken
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class SentryAppInstallationTokenTest(TestCase):
    def setUp(self) -> None:
        self.application = ApiApplication.objects.create(owner=self.user)
        self.provider = "provider"

        sentry_app = self.create_internal_integration(
            webhook_url=None,
            name="Vercel Internal Integration",
            organization=self.organization,
        )

        self.api_token = ApiToken.objects.create(
            user=self.user, scope_list=(), refresh_token=None, expires_at=None
        )

        self.install = SentryAppInstallation.objects.create(
            sentry_app=sentry_app,
            organization_id=self.organization.id,
        )

        SentryAppInstallationForProvider.objects.create(
            organization_id=self.organization.id,
            provider=self.provider,
            sentry_app_installation=self.install,
        )

    def test_get_token_empty(self) -> None:
        assert not SentryAppInstallationToken.objects.get_token(self.organization.id, self.provider)

    def test_get_token_invalid(self) -> None:
        assert not SentryAppInstallationToken.objects.get_token(self.organization.id, "")

    def test_get_token(self) -> None:
        SentryAppInstallationToken.objects.create(
            api_token=self.api_token, sentry_app_installation=self.install
        )
        token = SentryAppInstallationToken.objects.get_token(self.organization.id, self.provider)
        assert token == self.api_token.token

    def test_get_token_with_deleted_api_token(self) -> None:
        """Test that get_token returns None when the associated API token is deleted"""
        installation_token = SentryAppInstallationToken.objects.create(
            api_token=self.api_token, sentry_app_installation=self.install
        )
        
        # Verify the token is retrieved before deletion
        token = SentryAppInstallationToken.objects.get_token(self.organization.id, self.provider)
        assert token == self.api_token.token
        
        # Delete the API token
        self.api_token.delete()
        
        # Verify that get_token returns None after deletion
        token = SentryAppInstallationToken.objects.get_token(self.organization.id, self.provider)
        assert token is None
        
        # Verify the installation token record still exists but has no api_token
        installation_token.refresh_from_db()
        assert installation_token.api_token_id is None
