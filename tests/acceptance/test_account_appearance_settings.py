from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class AccountAppearanceSettingsTest(AcceptanceTestCase):
    def setUp(self):
        super(AccountAppearanceSettingsTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.login_as(self.user)
        self.path = '/account/settings/appearance/'

    def test_simple(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('.loading-indicator')
        self.browser.snapshot('account appearance settings')
