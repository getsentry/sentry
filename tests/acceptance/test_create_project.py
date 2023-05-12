from sentry.testutils import AcceptanceTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class CreateProjectTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger")
        self.login_as(self.user)

        self.path = f"/organizations/{self.org.slug}/projects/new/"

    def test_no_teams(self):
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[])
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading")

        self.browser.click('[data-test-id="create-team"]')
        self.browser.wait_until("[role='dialog']")
        input = self.browser.element('input[name="slug"]')
        input.send_keys("new-team")

        self.browser.element("[role='dialog'] form").submit()

        # After creating team, should end up in onboarding screen
        self.browser.wait_until(xpath='//div[text()="#new-team"]')
        self.browser.snapshot(name="create project no teams - after create team")

    def test_many_teams(self):
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.team2 = self.create_team(organization=self.org, name="team two")
        self.create_member(
            user=self.user, organization=self.org, role="owner", teams=[self.team, self.team2]
        )
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading")
        self.browser.snapshot(name="create project many teams")
