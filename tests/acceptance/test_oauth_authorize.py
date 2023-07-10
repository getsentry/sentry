from sentry.testutils import AcceptanceTestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
class OAuthAuthorizeTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com", is_superuser=True)
        self.login_as(self.user)

    def test_simple(self):
        self.browser.get("/debug/oauth/authorize/")
        self.browser.wait_until_not(".loading")
        self.browser.snapshot("oauth - authorize")
        self.browser.get("/debug/oauth/authorize/error/")
        self.browser.wait_until_not(".loading")
        self.browser.snapshot("oauth - authorize error")
