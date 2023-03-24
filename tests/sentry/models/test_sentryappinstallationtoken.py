from sentry.models import (
    ApiApplication,
    ApiToken,
    SentryAppInstallation,
    SentryAppInstallationForProvider,
    SentryAppInstallationToken,
)
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
class SentryAppInstallationTokenTest(TestCase):
    def setUp(self):
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
            organization=self.organization,
        )

        SentryAppInstallationForProvider.objects.create(
            organization=self.organization,
            provider=self.provider,
            sentry_app_installation=self.install,
        )

    def test_get_token_empty(self):
        assert not SentryAppInstallationToken.objects.get_token(self.organization.id, self.provider)

    def test_get_token_invalid(self):
        assert not SentryAppInstallationToken.objects.get_token(self.organization.id, "")

    def test_get_token(self):
        SentryAppInstallationToken.objects.create(
            api_token=self.api_token, sentry_app_installation=self.install
        )
        token = SentryAppInstallationToken.objects.get_token(self.organization.id, self.provider)
        assert token == self.api_token.token
