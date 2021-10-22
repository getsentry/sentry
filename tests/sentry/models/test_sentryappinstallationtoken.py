from sentry.models import ApiApplication, ApiToken, SentryApp, SentryAppInstallation, SentryAppInstallationForProvider, \
    SentryAppInstallationToken
from sentry.testutils import TestCase


class SentryAppInstallationTokenTest(TestCase):
    def setUp(self):
        self.application = ApiApplication.objects.create(owner=self.user)
        self.provider = "provider"

        self.sentry_app = SentryApp.objects.create(
            application=self.application,
            name="NullDB",
            proxy_user=self.proxy,
            owner=self.org,
            scope_list=("project:read",),
            webhook_url="http://example.com",
        )

        self.install = SentryAppInstallation(sentry_app=self.sentry_app, organization=self.organization)
        self.installation_for_provider = SentryAppInstallationForProvider.objects.create(
            organization=self.organization,
            provider=self.provider,
            sentry_app_installation=self.install,
        )

    def test_get_token_empty(self):
        assert not SentryAppInstallationToken.objects.get_token(self.organization.id, self.provider)

    def test_get_token_invalid(self):
        assert not SentryAppInstallationToken.objects.get_token(self.organization.id, "")

    def test_get_token(self):
        api_token = ApiToken.objects.create(
            user=self.user, scope_list=(), refresh_token=None, expires_at=None
        )
        token = SentryAppInstallationToken.objects.get_token(self.organization.id, self.provider)
        assert token.token == api_token.token

