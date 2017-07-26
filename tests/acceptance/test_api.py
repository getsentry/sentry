from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class ApiTokensTest(AcceptanceTestCase):
    def setUp(self):
        super(ApiTokensTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.login_as(self.user)
        self.path = '/api/'

    def test_simple(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('.loading')
        self.browser.snapshot('api tokens - no tokens')
        # self.browser.click('.ref-create-token')
        # self.browser.wait_until_not('.loading')
        # self.browser.snapshot('api tokens - new token')
        # self.browser.click('.btn-primary')
        # self.browser.wait_until_not('.loading')
        # self.browser.snapshot('api tokens - single token')


class ApiApplicationTest(AcceptanceTestCase):
    def setUp(self):
        super(ApiApplicationTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.login_as(self.user)
        self.path = '/api/applications/'

    def test_simple(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('.loading')
        self.browser.snapshot('api applications - no applications')
        # self.browser.click('.ref-create-application')
        # self.browser.wait_until_not('.loading')
        # self.browser.snapshot('api applications - new application')
        # self.browser.click('.btn-primary')
        # self.browser.wait_until_not('.loading')
        # self.browser.snapshot('api applications - single application')
