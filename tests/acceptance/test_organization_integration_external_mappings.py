from sentry.testutils import AcceptanceTestCase
from sentry.models import Integration


class OrganizationExternalMappings(AcceptanceTestCase):
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
            url="https://github.com/getsentry/sentry",
        )

    def load_page(self, slug, configuration_tab=False):
        url = f"/settings/{self.organization.slug}/integrations/{slug}/"
        if configuration_tab:
            url += "?tab=configurations"
        self.browser.get(url)
        self.browser.wait_until_not(".loading-indicator")

    def test_external_user_mappings(self):
        with self.feature(
            {
                "organizations:import-codeowners": True,
                "organizations:integrations-stacktrace-link": True,
            }
        ):

            self.browser.get(
                f"/settings/{self.organization.slug}/integrations/{self.provider}/{self.integration.id}/"
            )
            self.browser.wait_until_not(".loading-indicator")
            self.browser.click(".nav-tabs li:nth-child(3) a")
            self.browser.wait_until_not(".loading-indicator")

            # Empty state
            self.browser.snapshot("integrations - empty external user mappings")

            # Create mapping
            self.browser.click('[data-test-id="add-mapping-button"]')
            self.browser.wait_until(".modal-dialog")

            # Add Mapping Modal
            externalName = self.browser.find_element_by_name("externalName")
            externalName.send_keys("@admin")
            self.browser.click("#memberId:first-child div")
            self.browser.click('[id="react-select-2-option-0"]')
            self.browser.snapshot("integrations - save new external user mapping")

            # List View
            self.browser.click('[aria-label="Save Changes"]')
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("integrations - one external user mapping")

    def test_external_team_mappings(self):
        with self.feature(
            {
                "organizations:import-codeowners": True,
                "organizations:integrations-stacktrace-link": True,
            }
        ):

            self.browser.get(
                f"/settings/{self.organization.slug}/integrations/{self.provider}/{self.integration.id}/"
            )
            self.browser.wait_until_not(".loading-indicator")
            self.browser.click(".nav-tabs li:nth-child(4) a")
            self.browser.wait_until_not(".loading-indicator")

            # Empty state
            self.browser.snapshot("integrations - empty external team mappings")

            # Create mapping
            self.browser.click('[data-test-id="add-mapping-button"]')
            self.browser.wait_until(".modal-dialog")

            # Add Mapping Modal
            externalName = self.browser.find_element_by_name("externalName")
            externalName.send_keys("@getsentry/ecosystem")
            self.browser.click("#teamId:first-child div")
            self.browser.click('[id="react-select-2-option-0"]')
            self.browser.snapshot("integrations - save new external team mapping")

            # List View
            self.browser.click('[aria-label="Save Changes"]')
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("integrations - one external team mapping")
