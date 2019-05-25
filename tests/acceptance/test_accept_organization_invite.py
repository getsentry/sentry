from __future__ import absolute_import

from django.db.models import F

from sentry.testutils import AcceptanceTestCase
from sentry.models import Organization


class AcceptOrganizationInviteTest(AcceptanceTestCase):
    def setUp(self):
        super(AcceptOrganizationInviteTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            name='Rowdy Tiger',
            owner=None,
        )
        self.team = self.create_team(organization=self.org, name='Mariachi Band')
        self.member = self.create_member(
            user=None,
            email='bar@example.com',
            organization=self.org,
            role='owner',
            teams=[self.team],
        )

    def test_invite_simple(self):
        self.login_as(self.user)
        self.browser.get(self.member.get_invite_link().split('/', 3)[-1])
        self.browser.snapshot(name='accept organization invite')
        assert self.browser.element_exists_by_test_id('join-organization')

    def test_invite_not_authenticated(self):
        self.browser.get(self.member.get_invite_link().split('/', 3)[-1])
        assert self.browser.element_exists_by_test_id('create-account')

    def test_invite_2fa_enforced_org(self):
        self.login_as(self.user)
        self.org.update(flags=F('flags').bitor(Organization.flags.require_2fa))
        self.browser.get(self.member.get_invite_link().split('/', 3)[-1])
        assert self.browser.element_exists_by_test_id('setup-2fa')
