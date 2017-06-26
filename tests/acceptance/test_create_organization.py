from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class CreateOrganizationTest(AcceptanceTestCase):
    def setUp(self):
        super(CreateOrganizationTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.login_as(self.user)

    def test_simple(self):
        self.browser.get('/organizations/new/')
        self.browser.snapshot(name='create organization')
