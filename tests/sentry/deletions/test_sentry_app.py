import pytest
from django.db import connections, router

from sentry import deletions
from sentry.models.apiapplication import ApiApplication
from sentry.models.integrations.sentry_app import SentryApp
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.user import User
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TestSentryAppDeletionTask(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization()

        self.sentry_app = self.create_sentry_app(
            name="blah", organization=self.org, scopes=("project:read",)
        )

    def test_deletes_app_installations(self):
        install = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, user=self.user
        )
        deletions.exec_sync(self.sentry_app)
        assert not SentryAppInstallation.objects.filter(pk=install.id).exists()

    def test_deletes_api_application(self):
        application = self.sentry_app.application
        deletions.exec_sync(self.sentry_app)
        assert not ApiApplication.objects.filter(pk=application.id).exists()

    def test_deletes_proxy_user(self):
        proxy_user = self.sentry_app.proxy_user
        deletions.exec_sync(self.sentry_app)
        assert not User.objects.filter(pk=proxy_user.id).exists()

    def test_soft_deletes_sentry_app(self):
        deletions.exec_sync(self.sentry_app)

        with pytest.raises(SentryApp.DoesNotExist):
            SentryApp.objects.get(pk=self.sentry_app.id)

        # The QuerySet will automatically NOT include deleted installs, so we
        # use a raw sql query to ensure it still exists.
        c = connections[router.db_for_write(SentryApp)].cursor()
        c.execute(
            "SELECT count(1) "
            "FROM sentry_sentryapp "
            "WHERE id = %s AND date_deleted IS NOT NULL",
            [self.sentry_app.id],
        )

        assert c.fetchone()[0] == 1
