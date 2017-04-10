from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class AcceptOrganizationInviteTest(AcceptanceTestCase):
    def setUp(self):
        super(AcceptOrganizationInviteTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            name='Rowdy Tiger',
            owner=None,
        )
        self.team = self.create_team(
            organization=self.org,
            name='Mariachi Band'
        )
        self.member = self.create_member(
            user=None,
            email='bar@example.com',
            organization=self.org,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)

    def test_invite(self):
        self.browser.get(self.member.get_invite_link().split('/', 3)[-1])
        self.browser.snapshot(name='accept organization invite')
