from unittest import mock

from selenium.common.exceptions import TimeoutException

from sentry.models import Project
from sentry.testutils import AcceptanceTestCase
from sentry.utils.retries import TimedRetryPolicy


class OrganizationOnboardingTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.member = self.create_member(
            user=self.user, organization=self.org, role="owner", teams=[self.team]
        )
        self.login_as(self.user)

    @mock.patch("sentry.models.ProjectKey.generate_api_key", return_value="test-dsn")
    def test_onboarding(self, generate_api_key):
        self.browser.get("/onboarding/%s/" % self.org.slug)

        # Welcome step
        self.browser.wait_until('[data-test-id="onboarding-step-welcome"]')
        self.browser.snapshot(name="onboarding - new - welcome")

        # Platform selection step
        self.browser.click('[aria-label="Start"]')
        self.browser.wait_until('[data-test-id="onboarding-step-select-platform"]')

        self.browser.snapshot(name="onboarding - new - select platform")

        # Select and create node JS project
        self.browser.click('[data-test-id="platform-node"]')
        self.browser.wait_until_not('[data-test-id="platform-select-next"][aria-disabled="true"]')
        self.browser.wait_until('[data-test-id="platform-select-next"][aria-disabled="false"]')

        @TimedRetryPolicy.wrap(timeout=5, exceptions=((TimeoutException,)))
        def click_platform_select_name(browser):
            browser.click('[data-test-id="platform-select-next"]')
            # Project getting started
            browser.wait_until('[data-test-id="onboarding-step-setup-docs"]')

        click_platform_select_name(self.browser)
        self.browser.snapshot(name="onboarding - new - setup docs")

        # Verify project was created for org
        project = Project.objects.get(organization=self.org)
        assert project.name == "node"
        assert project.platform == "node"

        # The homepage should redirect to onboarding
        self.browser.get("/")
        self.browser.wait_until('[data-test-id="onboarding-step-setup-docs"]')
