from __future__ import absolute_import

from sentry.mediators.sentry_apps import Creator as SentryAppCreator
from sentry.mediators.sentry_app_installations import Creator
from sentry.models import ApiAuthorization
from sentry.testutils import TestCase


class TestCreator(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization()

        self.sentry_app = SentryAppCreator.run(
            name='nulldb',
            user=self.user,
            scopes=('project:read',),
            webhook_url='http://example.com',
        )

        self.creator = Creator(organization=self.org, slug='nulldb')

    def test_creates_api_authorization(self):
        install, grant = self.creator.call()

        assert ApiAuthorization.objects.get(
            application=self.sentry_app.application,
            user=self.sentry_app.proxy_user,
            scopes=self.sentry_app.scopes,
        )

    def test_creates_installation(self):
        install, grant = self.creator.call()
        assert install.pk

    def test_creates_api_grant(self):
        install, grant = self.creator.call()
        assert grant.pk

    def test_associations(self):
        install, grant = self.creator.call()

        assert install.api_grant == grant
        assert install.authorization is not None
