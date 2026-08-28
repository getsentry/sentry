from rest_framework.test import APIClient
from selenium.webdriver.common.by import By

from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import no_silo_test


@no_silo_test
class OrganizationServiceAccountsAcceptanceTest(AcceptanceTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization.flags.allow_joinleave = True
        self.organization.save()
        self.team = self.create_team(organization=self.organization, name="Operations")
        self.project = self.create_project(
            organization=self.organization,
            teams=[self.team],
            name="Automation target",
        )
        self.login_as(self.user)
        self.path = f"/settings/{self.organization.slug}/service-accounts/"

    def click_button(self, label: str) -> None:
        self.browser.find_element(
            by=By.XPATH,
            value=f"//button[normalize-space()='{label}']",
        ).click()

    @with_feature("organizations:service-accounts")
    def test_create_use_and_disable_service_account(self) -> None:
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.click_button("Create Service Account")
        self.browser.wait_until_test_id("modal-backdrop")

        self.browser.element('input[name="name"]').send_keys("Deploy bot")
        self.browser.click('button[type="submit"]')

        self.browser.wait_until('input[aria-label="New service account token"]')
        secret_input = self.browser.element('input[aria-label="New service account token"]')
        token = secret_input.get_attribute("value")
        assert token.startswith("sntryu_")
        self.browser.wait_until(xpath="//h2[normalize-space()='Deploy bot']")

        api_client = APIClient()
        authorization = f"Bearer {token}"
        organization = api_client.get(
            f"/api/0/organizations/{self.organization.slug}/",
            HTTP_AUTHORIZATION=authorization,
        )
        assert organization.status_code == 200, organization.content
        assert organization.data["id"] == str(self.organization.id)

        projects = api_client.get(
            f"/api/0/organizations/{self.organization.slug}/projects/",
            HTTP_AUTHORIZATION=authorization,
        )
        assert projects.status_code == 200, projects.content
        assert {int(project["id"]) for project in projects.data} == {self.project.id}

        teams = api_client.get(
            f"/api/0/organizations/{self.organization.slug}/teams/",
            HTTP_AUTHORIZATION=authorization,
        )
        assert teams.status_code == 200, teams.content
        assert {int(team["id"]) for team in teams.data} == {self.team.id}

        releases = api_client.get(
            f"/api/0/organizations/{self.organization.slug}/releases/",
            HTTP_AUTHORIZATION=authorization,
        )
        assert releases.status_code == 200, releases.content

        denied_write = api_client.post(
            f"/api/0/organizations/{self.organization.slug}/releases/",
            data={"version": "browser-created-token", "projects": [self.project.slug]},
            format="json",
            HTTP_AUTHORIZATION=authorization,
        )
        assert denied_write.status_code == 403, denied_write.content
        assert "project:releases" in denied_write["WWW-Authenticate"]

        self.click_button("Disable")
        self.browser.wait_until(xpath="//*[normalize-space()='Disabled']")

        denied = api_client.get(
            f"/api/0/organizations/{self.organization.slug}/projects/",
            HTTP_AUTHORIZATION=authorization,
        )
        assert denied.status_code == 401
