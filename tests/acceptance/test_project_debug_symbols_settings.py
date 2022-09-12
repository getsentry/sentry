from sentry.testutils import AcceptanceTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectSavedSearchesSettingsTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])

        self.login_as(self.user)

    def test_saved_searches(self):
        path = f"/{self.org.slug}/{self.project.slug}/settings/debug-symbols/"
        self.browser.get(path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.snapshot("project settings - debug symbols")
