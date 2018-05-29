from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class AccountNotificationSettingsTest(AcceptanceTestCase):
    def setUp(self):
        super(AccountNotificationSettingsTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            name='Rowdy Tiger',
            owner=None,
        )
        self.team = self.create_team(organization=self.org, name='Mariachi Band')
        self.project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name='Bengal',
        )
        self.create_member(
            user=self.user,
            organization=self.org,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)
        self.path = '/account/settings/notifications/'

    def test_simple(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('.loading-indicator')
        self.browser.snapshot('account notification settings')

    def test_new_simple(self):
        self.browser.get('/settings/account/notifications/')
        self.browser.wait_until_not('.loading-indicator')
        self.browser.snapshot('account notification - settings (new)')

        self.browser.click_when_visible('#Alerts a')
        self.browser.wait_until_not('.loading-indicator')
        self.browser.snapshot('account notification - fine tune "Alerts" (new)')
