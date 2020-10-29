from __future__ import absolute_import

from sentry.utils.compat.mock import patch

from sentry.mediators.sentry_app_installation_tokens import Destroyer
from sentry.models import AuditLogEntry, ApiToken, SentryAppInstallationToken, SentryAppInstallation
from sentry.testutils import TestCase


class TestDestroyer(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.create_project(organization=self.org)

        self.sentry_app = self.create_internal_integration(name="nulldb", organization=self.org)

        self.sentry_app_installation = SentryAppInstallation.objects.get(sentry_app=self.sentry_app)
        self.api_token = self.create_internal_integration_token(
            install=self.sentry_app_installation, user=self.user
        )

    @patch("sentry.analytics.record")
    def test_delete_token_with_audit(self, record):
        request = self.make_request(user=self.user, method="DELETE")
        api_token = Destroyer.run(
            api_token=self.api_token, user=self.user, generate_audit=True, request=request
        )

        assert not ApiToken.objects.filter(id=api_token.id).exists()
        assert not SentryAppInstallationToken.objects.filter(api_token_id=api_token.id).exists()

        log = AuditLogEntry.objects.get(organization=self.org)
        assert log.get_note() == "revoked a token for internal integration nulldb"
        assert log.organization == self.org
        assert log.target_object == api_token.id

        record.assert_called_with(
            "sentry_app_installation_token.deleted",
            user_id=self.user.id,
            organization_id=self.org.id,
            sentry_app_installation_id=self.sentry_app_installation.id,
            sentry_app=self.sentry_app.slug,
        )

    @patch("sentry.utils.audit.create_audit_entry")
    @patch("sentry.analytics.record")
    def test_delete_token_without_audit(self, record, create_audit_entry):
        request = self.make_request(user=self.user, method="DELETE")
        api_token = Destroyer.run(api_token=self.api_token, user=self.user, request=request)

        assert not ApiToken.objects.filter(id=api_token.id).exists()
        assert not SentryAppInstallationToken.objects.filter(api_token_id=api_token.id).exists()

        assert not create_audit_entry.called

        record.assert_called_with(
            "sentry_app_installation_token.deleted",
            user_id=self.user.id,
            organization_id=self.org.id,
            sentry_app_installation_id=self.sentry_app_installation.id,
            sentry_app=self.sentry_app.slug,
        )
