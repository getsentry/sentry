from selenium.webdriver.common.by import By

from sentry.models.integrations.integration import Integration
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class OrganizationIntegrationConfigurationTabs(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.provider = "github"
        self.integration = Integration.objects.create(
            provider=self.provider,
            external_id="some_github",
            name="Github",
            metadata={
                "access_token": "some_access_token",
                "expires_at": "2021-04-16T01:08:42",
                "icon": "https://avatars.githubusercontent.com/u/10491134?v=4",
                "domain_name": "github.com/getsentry",
                "account_type": "User",
            },
        )
        self.integration.add_organization(self.organization, self.user)
        self.create_repo(
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=self.integration.id,
            project=self.project,
            url="https://github.com/getsentry/sentry",
        )

    def load_page(self, slug, configuration_tab=False):
        url = f"/settings/{self.organization.slug}/integrations/{slug}/"
        if configuration_tab:
            url += "?tab=configurations"
        self.browser.get(url)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def test_external_user_mappings(self):
        # create `auth_user` records to differentiate `user_id` and `organization_member_id`
        self.create_sentry_app()
        self.user2 = self.create_user("user2@example.com")
        self.user3 = self.create_user("user3@example.com")

        self.team = self.create_team(
            organization=self.organization, slug="tiger-team", members=[self.user]
        )
        self.team2 = self.create_team(
            organization=self.organization, slug="tiger-team2", members=[self.user2]
        )
        self.team3 = self.create_team(
            organization=self.organization, slug="tiger-team3", members=[self.user3]
        )

        self.project = self.create_project(
            organization=self.organization, teams=[self.team, self.team2, self.team3], slug="bengal"
        )

        with self.feature("organizations:integrations-codeowners"):
            self.browser.get(
                f"/settings/{self.organization.slug}/integrations/{self.provider}/{self.integration.id}/"
            )
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.click(".nav-tabs li:nth-child(3) a")
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')

            # Empty state

            # Create mapping
            self.browser.click('[data-test-id="add-mapping-button"]')
            self.browser.wait_until("[role='dialog']")

            # Add Mapping Modal
            externalName = self.browser.find_element(by=By.NAME, value="externalName")
            externalName.send_keys("@user2")
            self.browser.click("#userId:first-child div")
            self.browser.click('[id="react-select-2-option-1"]')

            # List View
            self.browser.click('[aria-label="Save Changes"]')
            self.browser.wait_until_not('[aria-label="Save Changes"]')
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def test_external_team_mappings(self):
        with self.feature("organizations:integrations-codeowners"):
            self.browser.get(
                f"/settings/{self.organization.slug}/integrations/{self.provider}/{self.integration.id}/"
            )
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.click(".nav-tabs li:nth-child(4) a")
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')

            # Empty state

            # Create mapping
            self.browser.click('[data-test-id="add-mapping-button"]')
            self.browser.wait_until("[role='dialog']")

            # Add Mapping Modal
            externalName = self.browser.find_element(by=By.NAME, value="externalName")
            externalName.send_keys("@getsentry/ecosystem")
            self.browser.click("#teamId:first-child div")
            self.browser.click('[id="react-select-2-option-0"]')

            # List View
            self.browser.click('[aria-label="Save Changes"]')
            self.browser.wait_until_not('[aria-label="Save Changes"]')
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
