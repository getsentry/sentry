from sentry.models.organizationmember import OrganizationMember
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class ListOrganizationMembersTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
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
        self.browser.get(f"/organizations/{self.org.slug}/members/")
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        assert self.browser.element_exists_by_test_id("email-invite")
        assert self.browser.element_exists_by_aria_label("Resend invite")
