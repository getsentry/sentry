from __future__ import absolute_import

from django.db import connection
from sentry.utils.compat.mock import patch
import responses

from sentry.mediators.sentry_apps import Destroyer
from sentry.models import (
    AuditLogEntry,
    AuditLogEntryEvent,
    ApiApplication,
    User,
    SentryApp,
    SentryAppInstallation,
)
from sentry.testutils import TestCase


class TestDestroyer(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization()

        self.sentry_app = self.create_sentry_app(
            name="blah", organization=self.org, scopes=("project:read",)
        )

        self.destroyer = Destroyer(sentry_app=self.sentry_app, user=self.user)

    @responses.activate
    def test_deletes_app_installations(self):
        responses.add(responses.POST, "https://example.com/webhook", status=200)
        install = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, user=self.user
        )
        self.destroyer.call()
        assert not SentryAppInstallation.objects.filter(pk=install.id).exists()

    @patch("sentry.mediators.sentry_app_installations.Destroyer.run")
    def test_passes_notify_false_if_app_internal(self, run):
        self.create_project(organization=self.org)
        internal = self.create_internal_integration(organization=self.org)
        Destroyer.run(sentry_app=internal, user=self.user)
        run.assert_called_with(
            install=internal.installations.first(), user=internal.proxy_user, notify=False
        )

    def test_deletes_api_application(self):
        application = self.sentry_app.application

        self.destroyer.call()

        assert not ApiApplication.objects.filter(pk=application.id).exists()

    def test_deletes_proxy_user(self):
        proxy_user = self.sentry_app.proxy_user

        self.destroyer.call()

        assert not User.objects.filter(pk=proxy_user.id).exists()

    def test_creates_audit_log_entry(self):
        request = self.make_request(user=self.user, method="GET")
        Destroyer.run(user=self.user, sentry_app=self.sentry_app, request=request)
        assert AuditLogEntry.objects.filter(event=AuditLogEntryEvent.SENTRY_APP_REMOVE).exists()

    def test_soft_deletes_sentry_app(self):
        self.destroyer.call()

        with self.assertRaises(SentryApp.DoesNotExist):
            SentryApp.objects.get(pk=self.sentry_app.id)

        # The QuerySet will automatically NOT include deleted installs, so we
        # use a raw sql query to ensure it still exists.
        c = connection.cursor()
        c.execute(
            "SELECT count(1) "
            "FROM sentry_sentryapp "
            "WHERE id = %s AND date_deleted IS NOT NULL",
            [self.sentry_app.id],
        )

        assert c.fetchone()[0] == 1

    @patch("sentry.analytics.record")
    def test_records_analytics(self, record):
        Destroyer.run(
            user=self.user,
            sentry_app=self.sentry_app,
            request=self.make_request(user=self.user, method="GET"),
        )

        record.assert_called_with(
            "sentry_app.deleted",
            user_id=self.user.id,
            organization_id=self.org.id,
            sentry_app=self.sentry_app.slug,
        )
