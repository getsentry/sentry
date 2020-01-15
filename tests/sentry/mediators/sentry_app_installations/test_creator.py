from __future__ import absolute_import

import responses

from sentry.utils.compat.mock import patch

from sentry.constants import SentryAppInstallationStatus
from sentry.mediators.sentry_app_installations import Creator
from sentry.models import (
    AuditLogEntry,
    AuditLogEntryEvent,
    ApiGrant,
    ServiceHook,
    ServiceHookProject,
)
from sentry.testutils import TestCase


class TestCreator(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization()

        self.project1 = self.create_project(organization=self.org)
        self.project2 = self.create_project(organization=self.org)

        responses.add(responses.POST, "https://example.com/webhook")

        self.sentry_app = self.create_sentry_app(
            name="nulldb",
            organization=self.org,
            scopes=("project:read",),
            events=("issue.created",),
        )

        self.creator = Creator(organization=self.org, slug="nulldb", user=self.user)

    @responses.activate
    def test_creates_installation(self):
        responses.add(responses.POST, "https://example.com/webhook")
        install = self.creator.call()
        assert install.pk

    @responses.activate
    def test_creates_api_grant(self):
        responses.add(responses.POST, "https://example.com/webhook")
        install = self.creator.call()
        assert ApiGrant.objects.filter(id=install.api_grant_id).exists()

    @responses.activate
    def test_creates_service_hooks(self):
        responses.add(responses.POST, "https://example.com/webhook")
        install = self.creator.call()

        hook = ServiceHook.objects.get(organization_id=self.org.id)

        assert hook.application_id == self.sentry_app.application.id
        assert hook.actor_id == install.id
        assert hook.organization_id == self.org.id
        assert hook.events == self.sentry_app.events
        assert hook.url == self.sentry_app.webhook_url

        assert not ServiceHookProject.objects.all()

    @responses.activate
    def test_creates_audit_log_entry(self):
        responses.add(responses.POST, "https://example.com/webhook")
        request = self.make_request(user=self.user, method="GET")
        Creator.run(organization=self.org, slug="nulldb", user=self.user, request=request)
        assert AuditLogEntry.objects.filter(event=AuditLogEntryEvent.SENTRY_APP_INSTALL).exists()

    @responses.activate
    @patch("sentry.mediators.sentry_app_installations.InstallationNotifier.run")
    def test_notifies_service(self, run):
        with self.tasks():
            responses.add(responses.POST, "https://example.com/webhook")
            install = self.creator.call()
            run.assert_called_once_with(install=install, user=self.user, action="created")

    @responses.activate
    def test_associations(self):
        responses.add(responses.POST, "https://example.com/webhook")
        install = self.creator.call()

        assert install.api_grant is not None

    @responses.activate
    def test_pending_status(self):
        responses.add(responses.POST, "https://example.com/webhook")
        install = self.creator.call()

        assert install.status == SentryAppInstallationStatus.PENDING

    @responses.activate
    def test_installed_status(self):
        responses.add(responses.POST, "https://example.com/webhook")
        internal_app = self.create_internal_integration(name="internal", organization=self.org)
        creator = Creator(organization=self.org, slug=internal_app.slug, user=self.user)
        install = creator.call()

        assert install.status == SentryAppInstallationStatus.INSTALLED

    @patch("sentry.analytics.record")
    def test_records_analytics(self, record):
        Creator.run(
            organization=self.org,
            slug="nulldb",
            user=self.user,
            request=self.make_request(user=self.user, method="GET"),
        )

        record.assert_called_with(
            "sentry_app.installed",
            user_id=self.user.id,
            organization_id=self.org.id,
            sentry_app="nulldb",
        )
