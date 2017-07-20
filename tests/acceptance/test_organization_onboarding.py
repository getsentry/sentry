from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class CreateOrganizationTest(AcceptanceTestCase):
    def setUp(self):
        super(CreateOrganizationTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            name='Rowdy Tiger',
            owner=self.user,
        )
        self.login_as(self.user)

    def test_simple(self):
        self.browser.get('/onboarding/%s/' % self.org.slug)
        self.browser.snapshot(name='organization onboarding')
