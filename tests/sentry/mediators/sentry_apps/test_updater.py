from __future__ import absolute_import

from rest_framework.serializers import ValidationError

from sentry.mediators.sentry_apps import Creator, Updater
from sentry.testutils import TestCase


class TestUpdater(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.sentry_app = Creator.run(
            name='nulldb',
            user=self.user,
            scopes=('project:read',),
            webhook_url='http://example.com',
        )

        self.updater = Updater(sentry_app=self.sentry_app)

    def test_updates_name(self):
        self.updater.name = 'A New Thing'
        self.updater.call()
        assert self.sentry_app.name == 'A New Thing'

    def test_updates_scopes(self):
        self.updater.scopes = ('project:read', 'project:write', )
        self.updater.call()
        assert self.sentry_app.get_scopes() == \
            ['project:read', 'project:write']

    def test_rejects_scope_subtractions(self):
        self.updater.scopes = (None, )

        with self.assertRaises(ValidationError):
            self.updater.call()

    def test_updates_webhook_url(self):
        self.updater.webhook_url = 'http://example.com/hooks'
        self.updater.call()
        assert self.sentry_app.webhook_url == 'http://example.com/hooks'
