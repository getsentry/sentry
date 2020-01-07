from __future__ import absolute_import

from mock import patch, MagicMock

from sentry.mediators.sentry_apps import InternalCreator
from sentry.models import AuditLogEntryEvent, SentryApp, SentryAppInstallation
from sentry.testutils import TestCase
from sentry.testutils.helpers.faux import faux


class TestInternalCreator(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.creator = InternalCreator(
            name="nulldb",
            user=self.user,
            author="Sentry",
            organization=self.org,
            scopes=("project:read",),
            webhook_url="http://example.com",
            schema={"elements": [self.create_issue_link_schema()]},
        )

    def test_slug(self):
        sentry_app = self.creator.call()
        # test slug is the name + a UUID
        assert sentry_app.slug[:7] == "nulldb-"
        assert len(sentry_app.slug) == 13

    def test_creates_internal_sentry_app(self):
        sentry_app = self.creator.call()
        assert SentryApp.objects.filter(slug=sentry_app.slug).exists()

    def test_installs_to_org(self):
        sentry_app = self.creator.call()

        assert SentryAppInstallation.objects.filter(
            organization=self.org, sentry_app=sentry_app
        ).exists()

    @patch("sentry.tasks.sentry_apps.installation_webhook.delay")
    def test_does_not_notify_service(self, delay):
        self.creator.call()
        assert not len(delay.mock_calls)

    def test_creates_access_token(self):
        sentry_app = self.creator.call()

        install = SentryAppInstallation.objects.get(organization=self.org, sentry_app=sentry_app)

        assert install.api_token

    @patch("sentry.utils.audit.create_audit_entry")
    def test_audits(self, create_audit_entry):
        InternalCreator.run(
            name="nulldb",
            user=self.user,
            author="Sentry",
            organization=self.org,
            scopes=("project:read",),
            webhook_url="http://example.com",
            schema={"elements": [self.create_issue_link_schema()]},
            request=MagicMock(),
        )

        call = faux(create_audit_entry)
        assert call.kwarg_equals("organization", self.org)
        assert call.kwarg_equals("target_object", self.org.id)
        assert call.kwarg_equals("event", AuditLogEntryEvent.INTERNAL_INTEGRATION_ADD)

    @patch("sentry.analytics.record")
    @patch("sentry.utils.audit.create_audit_entry")
    def test_records_analytics(self, create_audit_entry, record):
        sentry_app = InternalCreator.run(
            name="nulldb",
            user=self.user,
            author="Sentry",
            organization=self.org,
            scopes=("project:read",),
            webhook_url="http://example.com",
            schema={"elements": [self.create_issue_link_schema()]},
            request=MagicMock(),
        )

        assert faux(record).args_equals("internal_integration.created")
        assert faux(record).kwargs == {
            "user_id": self.user.id,
            "organization_id": self.org.id,
            "sentry_app": sentry_app.slug,
        }
