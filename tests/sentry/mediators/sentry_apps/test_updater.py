from __future__ import absolute_import

from sentry.coreapi import APIError
from sentry.mediators.sentry_apps import Updater
from sentry.testutils import TestCase


class TestUpdater(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.sentry_app = self.create_sentry_app(
            name='nulldb',
            organization=self.org,
            scopes=('project:read',),
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
        sentry_app = self.create_sentry_app(
            name='sentry',
            organization=self.org,
            scopes=('project:read',),
            published=True,
        )
        updater = Updater(sentry_app=sentry_app)
        updater.scopes = ('project:read', 'project:write', )

        with self.assertRaises(APIError):
            updater.call()

    def test_doesnt_update_app_with_invalid_event_permissions(self):
        sentry_app = self.create_sentry_app(
            name='sentry',
            organization=self.org,
            scopes=('project:read',),
        )
        updater = Updater(sentry_app=sentry_app)
        updater.events = ('issue',)
        with self.assertRaises(APIError):
            updater.call()

    def test_updates_webhook_url(self):
        self.updater.webhook_url = 'http://example.com/hooks'
        self.updater.call()
        assert self.sentry_app.webhook_url == 'http://example.com/hooks'

    def test_updates_redirect_url(self):
        self.updater.redirect_url = 'http://example.com/finish-setup'
        self.updater.call()
        assert self.sentry_app.redirect_url == 'http://example.com/finish-setup'

    def test_updates_is_alertable(self):
        self.updater.is_alertable = True
        self.updater.call()
        assert self.sentry_app.is_alertable

    def test_updates_overview(self):
        self.updater.overview = 'Description of my very cool application'
        self.updater.call()
        assert self.updater.overview == 'Description of my very cool application'
