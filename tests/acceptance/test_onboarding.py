from sentry.models.project import Project
from sentry.testutils.asserts import verify_project_deletion
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
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

    def start_onboarding(self):
        self.browser.get("/onboarding/%s/" % self.org.slug)

        # Welcome step
        self.browser.wait_until('[data-test-id="onboarding-step-welcome"]')
        self.browser.click('[aria-label="Start"]')

        # Platform selection step
        self.browser.wait_until('[data-test-id="onboarding-step-select-platform"]')

    def click_on_platform(self, platform):
        self.browser.click(f'[data-test-id="platform-{platform}"]')

    def verify_project_creation(self, platform, heading):
        # Wait for the project setup page to load
        self.browser.wait_until(xpath=f'//h2[text()="Configure {heading} SDK"]')

        # Verify project was created for org
        project = Project.objects.get(organization=self.org, slug=platform)
        assert project.name == platform
        assert project.platform == platform

    def test_onboarding_happy_path(self):
        # Start onboarding
        self.start_onboarding()

        # Select React platform
        self.click_on_platform("javascript-react")

        # Verify project creation and docs load
        self.verify_project_creation("javascript-react", "React")

    def test_project_deletion_on_going_back(self):
        # Start onboarding
        self.start_onboarding()

        # Select Next.js platform
        self.click_on_platform("javascript-nextjs")

        # Verify project creation and docs load
        self.verify_project_creation("javascript-nextjs", "Next.js")

        # Click on custom back button
        self.browser.click('[aria-label="Back"]')

        # Verify project was deleted
        verify_project_deletion(self.org, "javascript-nextjs")

        # Select React platform
        self.click_on_platform("javascript-react")

        # Verify project creation and docs load
        self.verify_project_creation("javascript-react", "React")

        # Click on the browser native back button
        self.browser.back()

        # Verify project was deleted
        verify_project_deletion(self.org, "javascript-react")

        # Click on skip onboarding
        self.browser.click(xpath='//a[text()="Skip Onboarding"]')

        # Go to the projects overview page
        self.browser.get("/organizations/%s/projects/" % self.org.slug)

        # Verify that all projects are gone
        self.browser.wait_until(xpath='//h1[text()="Remain Calm"]')

    def test_framework_modal_open_by_selecting_vanilla_platform(self):
        # Start onboarding
        self.start_onboarding()

        # Select generic platform
        self.browser.click('[data-test-id="platform-javascript"]')

        # Modal is shown prompting to select a framework
        self.browser.wait_until(xpath='//h6[text()="Do you use a framework?"]')

        # Close modal
        self.browser.click('[aria-label="Close Modal"]')

        # Platform is not selected
        assert not self.browser.element_exists('[aria-label="Clear"]')

        # Click again on the modal and continue with the vanilla project
        self.browser.click('[data-test-id="platform-javascript"]')
        self.browser.click('[aria-label="Configure SDK"]')

        # Verify project creation and docs load
        self.verify_project_creation("javascript", "Browser JavaScript")
