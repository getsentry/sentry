from sentry.testutils.asserts import verify_project_deletion
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class CreateProjectTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=self.user)
        self.login_as(self.user)

        self.path = f"/organizations/{self.org.slug}/projects/new/"

    def select_platform_and_create_project(self, platform, heading):
        self.browser.click(f'[data-test-id="platform-{platform}"]')
        self.browser.click('[data-test-id="create-project"]')

        # Wait for the project setup page to load
        self.browser.wait_until(xpath=f'//h2[text()="Configure {heading} SDK"]')

    def load_project_creation_page(self):
        self.browser.get(self.path)
        self.browser.wait_until('[aria-label="Create Project"]')

    def test_no_teams(self):
        self.load_project_creation_page()

        self.browser.click(None, "//*[text()='Select a Team']")
        self.browser.click('[data-test-id="create-team-option"]')
        self.browser.wait_until("[role='dialog']")
        input = self.browser.element('input[name="slug"]')
        input.send_keys("new-team")

        self.browser.element("[role='dialog'] form").submit()

        # After creating team, should end up in onboarding screen
        self.browser.wait_until(xpath='//div[text()="#new-team"]')

    def test_select_correct_platform(self):
        self.create_team(organization=self.org, name="team three")

        self.load_project_creation_page()

        # Select React platform
        self.select_platform_and_create_project("javascript-react", "React")

    def test_project_deletion_on_going_back(self):
        self.create_team(organization=self.org, name="team three")

        self.load_project_creation_page()

        # Select PHP Laravel platform
        self.select_platform_and_create_project("php-laravel", "Laravel")

        # Click on custom back button
        self.browser.click('[aria-label="Back to Platform Selection"]')

        # Verify project was deleted
        verify_project_deletion(self.org, "platform-php-laravel")

        # Select Next.js platform
        self.select_platform_and_create_project("javascript-nextjs", "Next.js")

        # Click on the browser native back button
        self.browser.back()

        # Verify project was deleted
        verify_project_deletion(self.org, "javascript-nextjs")

        # Go to the projects overview page
        self.browser.get("/organizations/%s/projects/" % self.org.slug)

        # Verify that all projects are gone
        self.browser.wait_until(xpath='//h1[text()="Remain Calm"]')
