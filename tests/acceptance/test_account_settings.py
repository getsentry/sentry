from sentry.testutils import AcceptanceTestCase


class AccountSettingsTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
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

    def test_account_security_settings(self):
        with self.feature("organizations:onboarding"):
            self.browser.get("/settings/account/security/")
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.snapshot("account security settings")

    def test_account_notifications(self):
        with self.feature("organizations:onboarding"):
            self.browser.get("/settings/account/notifications/")
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.snapshot("account notification settings")

            self.browser.click_when_visible('[data-test-id="fine-tuning"]')
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.snapshot('account notification - fine tune "Alerts"')

    def test_account_emails_settings(self):
        with self.feature("organizations:onboarding"):
            self.browser.get("/settings/account/emails/")
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.snapshot("account emails settings")

    def test_account_subscriptions_settings(self):
        with self.feature("organizations:onboarding"):
            self.browser.get("/settings/account/subscriptions/")
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.snapshot("account subscriptions settings")

    def test_account_authorizations_settings(self):
        with self.feature("organizations:onboarding"):
            self.browser.get("/account/authorizations/")
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.snapshot("account authorizations settings")

    def test_account_identities_settings(self):
        with self.feature("organizations:onboarding"):
            self.browser.get("/settings/account/identities/")
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.snapshot("account identities settings")

    def test_close_account(self):
        with self.feature("organizations:onboarding"):
            self.browser.get("/account/remove/")
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.snapshot("account settings - close account")
