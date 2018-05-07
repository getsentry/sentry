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
            organization=self.org, name='Mariachi Band')
        self.team = self.create_team(
            organization=self.org, name='Other Team')
        self.team = self.create_team(
            organization=self.org, name='team three')

        self.create_member(
            user=self.user,
            organization=self.org,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)

    def test_invite(self):
        """
        Add by email
        """
        self.browser.get(
            '/organizations/{}/members/new/'.format(self.org.slug))
        self.browser.wait_until_not('.loading')
        self.browser.element('.checkbox').click()

        self.browser.element(
            'input#id-email').send_keys('test@gmail.com, invalidemail')

        self.browser.snapshot(name='invite organization member')
