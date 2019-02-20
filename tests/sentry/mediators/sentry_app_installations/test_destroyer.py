from __future__ import absolute_import

import responses

from django.db import connection

from sentry.mediators.sentry_app_installations import Creator, Destroyer
from sentry.models import ApiAuthorization, ApiGrant, SentryAppInstallation, ServiceHook
from sentry.testutils import TestCase


class TestDestroyer(TestCase):
    @responses.activate
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)

        responses.add(responses.POST, 'https://example.com/webhook')

        self.sentry_app = self.create_sentry_app(
            name='nulldb',
            organization=self.org,
            scopes=('project:read', 'event:read'),
            events=('issue',),
        )

        self.install = Creator.run(
            organization=self.org,
            slug='nulldb',
            user=self.user,
        )

        self.destroyer = Destroyer(
            install=self.install,
            user=self.user,
        )

    @responses.activate
    def test_deletes_authorization(self):
        auth = self.install.authorization

        responses.add(responses.POST, 'https://example.com/webhook')
        self.destroyer.call()

        assert not ApiAuthorization.objects.filter(pk=auth.id).exists()

    @responses.activate
    def test_deletes_grant(self):
        grant = self.install.api_grant

        responses.add(responses.POST, 'https://example.com/webhook')
        self.destroyer.call()

        assert not ApiGrant.objects.filter(pk=grant.id).exists()

    @responses.activate
    def test_deletes_without_grant(self):
        self.install.api_grant.delete()
        self.install.update(api_grant=None)

        responses.add(responses.POST, 'https://example.com/webhook')
        assert self.destroyer.call()

    @responses.activate
    def test_deletes_service_hooks(self):
        hook = self.create_service_hook(
            application=self.sentry_app.application,
            org=self.org,
            project=self.project,
            actor=self.install,
        )

        responses.add(responses.POST, 'https://example.com/webhook')
        self.destroyer.call()

        assert not ServiceHook.objects.filter(pk=hook.id).exists()

    @responses.activate
    def test_soft_deletes_installation(self):
        responses.add(responses.POST, 'https://example.com/webhook')
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
