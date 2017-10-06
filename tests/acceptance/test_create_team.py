from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class CreateTeamTest(AcceptanceTestCase):
    def setUp(self):
        super(CreateTeamTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            name='Rowdy Tiger',
            owner=self.user,
        )
        self.login_as(self.user)

    def test_simple(self):
        self.browser.get('/organizations/{}/teams/new/'.format(self.org.slug))
        self.browser.wait_until_not('.loading')
        self.browser.snapshot(name='create team')
