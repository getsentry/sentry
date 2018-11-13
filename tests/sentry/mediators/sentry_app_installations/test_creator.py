from __future__ import absolute_import

from mock import patch

from sentry.mediators.sentry_app_installations import Creator
from sentry.models import ApiAuthorization
from sentry.testutils import TestCase


class TestCreator(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization()

        self.sentry_app = self.create_sentry_app(
            name='nulldb',
            organization=self.org,
            scopes=('project:read',),
        )

        self.creator = Creator(
            organization=self.org,
            slug='nulldb',
            user=self.user,
        )

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

    @patch('sentry.tasks.app_platform.installation_webhook.delay')
    def test_notifies_service(self, installation_webhook):
        install, _ = self.creator.call()
        installation_webhook.assert_called_once_with(install.id, self.user.id)

    def test_associations(self):
        install, grant = self.creator.call()

        assert install.api_grant == grant
        assert install.authorization is not None
