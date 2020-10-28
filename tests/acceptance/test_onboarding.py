from __future__ import absolute_import

from sentry.utils.compat import mock
from selenium.common.exceptions import TimeoutException

from sentry.models import Project
from sentry.testutils import AcceptanceTestCase
from sentry.utils.retries import TimedRetryPolicy


class OrganizationOnboardingTest(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationOnboardingTest, self).setUp()
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
        self.browser.snapshot(name="onboarding - welcome")

        # Platform selection step
        self.browser.click('[data-test-id="welcome-next"]')
        self.browser.wait_until('[data-test-id="onboarding-step-select-platform"]')

        self.browser.snapshot(name="onboarding - select platform")

        # Select and create node JS project
        self.browser.click('[data-test-id="platform-node"]')
        self.browser.wait_until_not('[data-test-id="platform-select-next"][aria-disabled="true"]')
        self.browser.wait_until('[data-test-id="platform-select-next"][aria-disabled="false"]')

        @TimedRetryPolicy.wrap(timeout=5, exceptions=((TimeoutException,)))
        def click_platform_select_name(browser):
            browser.click('[data-test-id="platform-select-next"]')
            # Project getting started
            browser.wait_until('[data-test-id="onboarding-step-get-started"]')

        click_platform_select_name(self.browser)
        self.browser.snapshot(name="onboarding - get started")

        # Verify project was created for org
        project = Project.objects.get(organization=self.org)
        assert project.name == "rowdy-tiger"
        assert project.platform == "node"

        self.browser.click('[data-test-id="onboarding-getting-started-invite-members"]')
        self.browser.wait_until('[name="email"]')
        self.browser.snapshot(name="onboarding - invite members")

        self.browser.click('[data-test-id="onboarding-getting-started-learn-more"]')
        self.browser.wait_until_not('[name="email"]')
        self.browser.snapshot(name="onboarding - learn more")
