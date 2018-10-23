from __future__ import absolute_import

from sentry.coreapi import APIError
from sentry.constants import SentryAppStatus
from sentry.mediators.sentry_apps import Creator, Updater
from sentry.testutils import TestCase


class TestUpdater(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.sentry_app = Creator.run(
            name='nulldb',
            organization=self.org,
            scopes=('project:read',),
            webhook_url='http://example.com',
        )

        self.updater = Updater(sentry_app=self.sentry_app)

    def test_updates_name(self):
        self.updater.name = 'A New Thing'
        self.updater.call()
        assert self.sentry_app.name == 'A New Thing'

    def test_updates_unpublished_app_scopes(self):
        self.updater.scopes = ('project:read', 'project:write', )
        self.updater.call()
        assert self.sentry_app.get_scopes() == \
            ['project:read', 'project:write']

    def test_doesnt_update_published_app_scopes(self):
        sentry_app = Creator.run(
            name='sentry',
            organization=self.org,
            scopes=('project:read',),
            webhook_url='http://example.com',
        )
        sentry_app.update(status=SentryAppStatus.PUBLISHED)
        updater = Updater(sentry_app=sentry_app)
        updater.scopes = ('project:read', 'project:write', )

        with self.assertRaises(APIError):
            updater.call()

    def test_updates_webhook_url(self):
        self.updater.webhook_url = 'http://example.com/hooks'
        self.updater.call()
        assert self.sentry_app.webhook_url == 'http://example.com/hooks'
