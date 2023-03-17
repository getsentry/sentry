import pytest
from django.db import connection

from sentry import deletions
from sentry.models import (
    ApiGrant,
    ApiToken,
    SentryAppInstallation,
    SentryAppInstallationForProvider,
    ServiceHook,
)
from sentry.sentry_apps import SentryAppInstallationCreator
from sentry.tasks.deletion.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.testutils import TestCase
from sentry.testutils.outbox import outbox_runner


class TestSentryAppIntallationDeletionTask(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)

        self.sentry_app = self.create_sentry_app(
            name="nulldb",
            organization=self.org,
            scopes=("project:read", "event:read"),
            events=("issue",),
        )

        self.install = SentryAppInstallationCreator(organization_id=self.org.id, slug="nulldb").run(
            user=self.user, request=None
        )

    def test_deletes_grant(self):
        grant = self.install.api_grant
        deletions.exec_sync(self.install)
        assert not ApiGrant.objects.filter(pk=grant.id).exists()

    def test_deletes_without_grant(self):
        self.install.api_grant.delete()
        self.install.update(api_grant=None)
        deletions.exec_sync(self.install)

    def test_deletes_api_tokens(self):
        internal_app = self.create_internal_integration(organization=self.org, slug="internal")
        install = SentryAppInstallation.objects.get(sentry_app_id=internal_app.id)
        api_token = install.api_token

        deletions.exec_sync(install)

        assert not ApiToken.objects.filter(pk=api_token.id).exists()

    def test_deletes_installation_provider(self):
        SentryAppInstallationForProvider.objects.create(
            sentry_app_installation=self.install, organization=self.org, provider="vercel"
        )
        deletions.exec_sync(self.install)

        assert not SentryAppInstallationForProvider.objects.filter()

    def test_deletes_service_hooks(self):
        hook = self.create_service_hook(
            application=self.sentry_app.application,
            org=self.org,
            actor=self.install,
            installation_id=self.install.id,
        )

        with outbox_runner():
            deletions.exec_sync(self.install)
        assert ServiceHook.objects.filter(pk=hook.id).exists()

        with self.tasks():
            schedule_hybrid_cloud_foreign_key_jobs()

        assert not ServiceHook.objects.filter(pk=hook.id).exists()

    def test_soft_deletes_installation(self):
        deletions.exec_sync(self.install)

        with pytest.raises(SentryAppInstallation.DoesNotExist):
            SentryAppInstallation.objects.get(pk=self.install.id)

        # The QuerySet will automatically NOT include deleted installs, so we
        # use a raw sql query to ensure it still exists.
        c = connection.cursor()
        c.execute(
            "SELECT COUNT(1) "
            "FROM sentry_sentryappinstallation "
            "WHERE id = %s AND date_deleted IS NOT NULL",
            [self.install.id],
        )

        assert c.fetchone()[0] == 1
