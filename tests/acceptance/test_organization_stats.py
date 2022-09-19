from django.utils import timezone

from sentry.testutils import AcceptanceTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationStatsTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Org Name")
        self.team = self.create_team(name="Team Name", organization=self.org, members=[self.user])
        self.project = self.create_project(
            organization=self.org, teams=[self.team], name="Project Name"
        )
        self.login_as(self.user)
        self.path = f"/organizations/{self.org.slug}/stats/"

    def test_simple(self):
        self.project.update(first_event=timezone.now())
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.snapshot("organization stats")
