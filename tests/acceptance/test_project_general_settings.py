from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class ProjectGeneralSettingsTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])

        self.login_as(self.user)

    def test_saved_searches(self):
        path = f"/{self.org.slug}/{self.project.slug}/settings/"
        self.browser.get(path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def test_mobile_menu(self):
        """
        It is only possible to open the menu at mobile widths
        """
        path = f"/{self.org.slug}/{self.project.slug}/settings/"

        with self.browser.mobile_viewport():
            self.browser.get(path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')

            self.browser.click('[aria-label="Open the menu"]')
            self.browser.wait_until("body.scroll-lock")
