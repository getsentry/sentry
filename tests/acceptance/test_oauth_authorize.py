from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class OAuthAuthorizeTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com", is_superuser=True)
        self.login_as(self.user)

    def test_simple(self):
        self.browser.get("/debug/oauth/authorize/")
        self.browser.wait_until_not(".loading")
        self.browser.get("/debug/oauth/authorize/error/")
        self.browser.wait_until_not(".loading")
