from __future__ import absolute_import

from django.db import connection

from sentry.mediators.sentry_app_installations import Creator, Destroyer
from sentry.models import ApiAuthorization, ApiGrant, SentryAppInstallation
from sentry.testutils import TestCase


class TestDestroyer(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization()

        self.sentry_app = self.create_sentry_app(
            name='nulldb',
            organization=self.org,
            scopes=('project:read',),
        )

        self.install = Creator.run(
            organization=self.org,
            slug='nulldb',
            user=self.user,
        )

        self.destroyer = Destroyer(install=self.install)

    def test_deletes_authorization(self):
        auth = self.install.authorization

        self.destroyer.call()

        assert not ApiAuthorization.objects.filter(pk=auth.id).exists()

    def test_deletes_grant(self):
        grant = self.install.api_grant

        self.destroyer.call()

        assert not ApiGrant.objects.filter(pk=grant.id).exists()

    def test_soft_deletes_installation(self):
        self.destroyer.call()

        with self.assertRaises(SentryAppInstallation.DoesNotExist):
            SentryAppInstallation.objects.get(pk=self.install.id)

        # The QuerySet will automatically NOT include deleted installs, so we
        # use a raw sql query to ensure it still exists.
        c = connection.cursor()
        c.execute(
            'SELECT COUNT(1) '
            'FROM sentry_sentryappinstallation '
            'WHERE id = %s AND date_deleted IS NOT NULL',
            [self.install.id])

        assert c.fetchone()[0] == 1
