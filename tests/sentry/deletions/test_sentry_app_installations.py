import pytest
from django.db import router
from django.db.transaction import get_connection

from sentry import deletions
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.integrations.sentry_app_installation_for_provider import (
    SentryAppInstallationForProvider,
)
from sentry.models.servicehook import ServiceHook
from sentry.sentry_apps.installations import SentryAppInstallationCreator
from sentry.silo import unguarded_write
from sentry.silo.base import SiloMode
from sentry.tasks.deletion.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class TestSentryAppInstallationDeletionTask(TestCase):
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
        assert self.install.api_grant is not None
        grant = self.install.api_grant
        deletions.exec_sync(self.install)
        assert not ApiGrant.objects.filter(pk=grant.id).exists()

    def test_deletes_without_grant(self):
        assert self.install.api_grant is not None
        with unguarded_write(router.db_for_write(ApiGrant)):
            self.install.api_grant.delete()
        self.install.update(api_grant=None)
        deletions.exec_sync(self.install)

    def test_deletes_api_tokens(self):
        internal_app = self.create_internal_integration(organization=self.org)
        install = SentryAppInstallation.objects.get(sentry_app_id=internal_app.id)
        api_token = install.api_token

        deletions.exec_sync(install)

        assert not ApiToken.objects.filter(pk=api_token.id).exists()

    def test_deletes_installation_provider(self):
        SentryAppInstallationForProvider.objects.create(
            sentry_app_installation=self.install, organization_id=self.org.id, provider="vercel"
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

        with assume_test_silo_mode(SiloMode.REGION):
            assert ServiceHook.objects.filter(pk=hook.id).exists()

        with self.tasks(), assume_test_silo_mode(SiloMode.MONOLITH):
            schedule_hybrid_cloud_foreign_key_jobs()

        with assume_test_silo_mode(SiloMode.REGION):
            assert not ServiceHook.objects.filter(pk=hook.id).exists()

    def test_soft_deletes_installation(self):
        deletions.exec_sync(self.install)

        with pytest.raises(SentryAppInstallation.DoesNotExist):
            SentryAppInstallation.objects.get(pk=self.install.id)

        # The QuerySet will automatically NOT include deleted installs, so we
        # use a raw sql query to ensure it still exists.
        c = get_connection(router.db_for_write(SentryAppInstallation)).cursor()
        c.execute(
            "SELECT COUNT(1) "
            "FROM sentry_sentryappinstallation "
            "WHERE id = %s AND date_deleted IS NOT NULL",
            [self.install.id],
        )

        assert c.fetchone()[0] == 1
