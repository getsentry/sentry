from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class OAuthAuthorizeTest(AcceptanceTestCase):
    def setUp(self):
        super(OAuthAuthorizeTest, self).setUp()
        self.user = self.create_user("foo@example.com", is_superuser=True)
        self.login_as(self.user)

    def test_simple(self):
        self.browser.get("/debug/oauth/authorize/")
        self.browser.wait_until_not(".loading")
        self.browser.snapshot("oauth - authorize")
        self.browser.get("/debug/oauth/authorize/error/")
        self.browser.wait_until_not(".loading")
        self.browser.snapshot("oauth - authorize error")
