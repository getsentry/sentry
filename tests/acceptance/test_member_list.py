from __future__ import absolute_import

from sentry.models import OrganizationMember
from sentry.testutils import AcceptanceTestCase


class ListOrganizationMembersTest(AcceptanceTestCase):
    def setUp(self):
        super(ListOrganizationMembersTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])
        OrganizationMember.objects.create(
            email="bar@example.com", organization=self.org, role="member"
        )
        self.create_member(
            user=self.create_user("baz@example.com"),
            organization=self.org,
            role="admin",
            teams=[self.team],
        )
        self.login_as(self.user)

    def test_list(self):
        self.browser.get(u"/organizations/{}/members/".format(self.org.slug))
        self.browser.wait_until_not(".loading-indicator")
        self.browser.snapshot(name="list organization members")
        assert self.browser.element_exists_by_aria_label("Invite Members")
        assert self.browser.element_exists_by_aria_label("Resend invite")
