from __future__ import absolute_import

from sentry.mediators.sentry_apps import Creator
from sentry.models import ApiApplication, SentryApp, User
from sentry.testutils import TestCase


class TestCreator(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.creator = Creator(name='nulldb',
                               organization=self.org,
                               scopes=('project:read',),
                               webhook_url='http://example.com')

    def test_creates_proxy_user(self):
        self.creator.call()

        assert User.objects.get(
            username='nulldb',
            is_sentry_app=True,
        )

    def test_creates_api_application(self):
        self.creator.call()
        proxy = User.objects.get(username='nulldb')

        assert ApiApplication.objects.get(owner=proxy)

    def test_creates_sentry_app(self):
        self.creator.call()

        proxy = User.objects.get(username='nulldb')
        app = ApiApplication.objects.get(owner=proxy)

        sentry_app = SentryApp.objects.get(
            name='nulldb',
            application=app,
            owner=self.org,
            proxy_user=proxy,
        )

        assert sentry_app
        assert sentry_app.scope_list == ['project:read']

    def test_expands_rolled_up_events(self):
        self.creator.events = ['issue']
        app = self.creator.call()

        sentry_app = SentryApp.objects.get(id=app.id)

        assert 'issue.created' in sentry_app.events
