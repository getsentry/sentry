from sentry import deletions
from sentry.models.apitoken import ApiToken
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.integrations.sentry_app_installation_token import SentryAppInstallationToken
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TestSentryInstallationTokenDeletionTask(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.create_project(organization=self.org)

        self.sentry_app = self.create_internal_integration(name="nulldb", organization=self.org)

        self.sentry_app_installation = SentryAppInstallation.objects.get(sentry_app=self.sentry_app)
        self.api_token = self.create_internal_integration_token(
            install=self.sentry_app_installation, user=self.user
        )

    def test_delete_token_without_audit(self):
        deletions.exec_sync(SentryAppInstallationToken.objects.get(api_token=self.api_token))

        assert not ApiToken.objects.filter(id=self.api_token.id).exists()
        assert not SentryAppInstallationToken.objects.filter(
            api_token_id=self.api_token.id
        ).exists()
