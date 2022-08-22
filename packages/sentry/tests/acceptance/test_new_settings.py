from sentry.testutils import AcceptanceTestCase


class NewSettingsTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(
            name="A Very Very Very Very Long Username", email="foo@example.com"
        )
        self.org = self.create_organization(
            name="A Very Very Very Very Long Organization", owner=self.user
        )
        self.login_as(self.user)
        self.path = "/settings/"

    def test_settings_index(self):
        with self.feature("organizations:onboarding"):
            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.snapshot("new settings index")
