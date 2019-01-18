from __future__ import absolute_import

from mock import patch

from sentry.mediators import sentry_app_installations
from sentry.tasks.app_platform import installation_webhook
from sentry.testutils import TestCase


class TestAppPlatformTasks(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)

        self.sentry_app = self.create_sentry_app(
            name='foo',
            organization=self.org,
            webhook_url='https://example.com',
            scopes=(),
        )

        self.install = sentry_app_installations.Creator.run(
            slug='foo',
            organization=self.org,
            user=self.user,
        )

    @patch('sentry.mediators.sentry_app_installations.InstallationNotifier.run')
    def test_installation_webhook(self, run):
        with self.tasks():
            installation_webhook(self.install.id, self.user.id)

        run.assert_called_once_with(install=self.install, user=self.user, action='created')
