from __future__ import absolute_import

import pytest

from sentry.testutils import AcceptanceTestCase


class AccountSettingsTest(AcceptanceTestCase):
    def setUp(self):
        super(AccountSettingsTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger Rowdy Tiger Rowdy Tiger", owner=None)
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band Mariachi Band Mariachi Band"
        )
        self.project = self.create_project(
            organization=self.org, teams=[self.team], name="Bengal Bengal Bengal Bengal"
        )
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])
        second_org = self.create_organization(name="Multiple Owners", owner=self.user)
        self.create_member(
            user=self.create_user("bar@example.com"), organization=second_org, role="owner"
        )
        self.login_as(self.user)

    # TODO(billy): Enable this and remove the slower tests below
    @pytest.mark.skip(
        reason="This will be faster but does not check if old django routes are redirecting"
    )
    def test_account_settings(self):
        with self.feature("organizations:onboarding"):
            path = "/account/settings/"
            self.browser.get(path)
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("account settings")

            self.browser.click('[href="/settings/account/security/"]')
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("account security settings")

            self.browser.click('[href="/settings/account/notifications/"]')
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("account notification settings")

            self.browser.click_when_visible("#Alerts a")
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot('account notification - fine tune "Alerts"')

            self.browser.click('[href="/settings/account/emails/"]')
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("account emails settings")

            self.browser.click('[href="/settings/account/subscriptions/"]')
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("account subscriptions settings")

            self.browser.click('[href="/settings/account/authorizations/"]')
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("account authorizations settings")

            self.browser.click('[href="/settings/account/identities/"]')
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("account identities settings")

            self.browser.click('[href="/settings/account/close-account/"]')
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("account settings - close account")

    def test_account_appearance_settings(self):
        with self.feature("organizations:onboarding"):
            self.browser.get("/account/settings/appearance/")
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("account appearance settings")

    def test_account_security_settings(self):
        with self.feature("organizations:onboarding"):
            self.browser.get("/account/settings/security/")
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("account security settings")

    def test_account_notifications(self):
        with self.feature("organizations:onboarding"):
            self.browser.get("/account/settings/notifications/")
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("account notification settings")

            self.browser.click_when_visible("#Alerts a")
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot('account notification - fine tune "Alerts"')

    def test_account_emails_settings(self):
        with self.feature("organizations:onboarding"):
            self.browser.get("/account/settings/emails/")
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("account emails settings")

    def test_account_subscriptions_settings(self):
        with self.feature("organizations:onboarding"):
            self.browser.get("/account/settings/subscriptions/")
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("account subscriptions settings")

    def test_account_authorizations_settings(self):
        with self.feature("organizations:onboarding"):
            self.browser.get("/account/authorizations/")
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("account authorizations settings")

    def test_account_identities_settings(self):
        with self.feature("organizations:onboarding"):
            self.browser.get("/account/settings/identities/")
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("account identities settings")

    def test_close_account(self):
        with self.feature("organizations:onboarding"):
            self.browser.get("/account/remove/")
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("account settings - close account")
