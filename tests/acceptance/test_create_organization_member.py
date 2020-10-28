from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class CreateOrganizationMemberTest(AcceptanceTestCase):
    def setUp(self):
        super(CreateOrganizationMemberTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.team = self.create_team(organization=self.org, name="Other Team")
        self.team = self.create_team(organization=self.org, name="team three")

        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])
        self.login_as(self.user)

    def test_invite_new_member(self):
        self.browser.get("/organizations/{}/members/new/".format(self.org.slug))
        self.browser.wait_until_not(".loading")

        email = "test@example.com"
        self.browser.element("input#id-email").send_keys(email)

        # Open team select dropdown, and click the first team
        self.browser.click('[aria-label="Add Team"]')
        self.browser.click('[data-test-id="autocomplete-list"] div')

        self.browser.snapshot(name="invite organization member")

        # Submit the form
        self.browser.click('[aria-label="Add Member"]')

        # Verify new member on member list.
        self.browser.wait_until_test_id("org-member-list")
        assert self.browser.element_exists_by_test_id(email)
