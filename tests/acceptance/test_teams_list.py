from django.utils import timezone

from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class TeamsListTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])
        self.login_as(self.user)
        # this should redirect to /settings/{}/teams/
        self.path = f"/organizations/{self.org.slug}/teams/"

    def test_simple(self):
        self.project.update(first_event=timezone.now())
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until_test_id("team-list")

        # team details link
        self.browser.click('[data-test-id="team-list"] a[href]:first-child')
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

        # Click projects tab
        self.browser.click(".nav-tabs li:nth-child(2) a")
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

        # Click projects tab
        self.browser.click(".nav-tabs li:nth-child(3) a")
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
