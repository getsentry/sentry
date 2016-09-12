from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class CreateOrganizationMemberTest(AcceptanceTestCase):
    def setUp(self):
        super(CreateOrganizationMemberTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            name='Rowdy Tiger',
            owner=None,
        )
        self.team = self.create_team(
            organization=self.org,
            name='Mariachi Band'
        )
        self.create_member(
            user=self.user,
            organization=self.org,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)

    def test_invite(self):
        """
        Add by username (on-premises / by configuration only)
        """
        self.browser.get('/organizations/{}/members/new'.format(self.org.slug))
        self.browser.snapshot(name='invite organization member')
