import pytest

from sentry.models.project import Project
from sentry.testutils.asserts import assert_existing_projects_status
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
        self.browser.wait_until(xpath='//div[text()="#new-team"]')

    def test_select_correct_platform(self):
        self.create_team(organization=self.org, name="team three")
        self.load_project_creation_page()
        self.browser.click("[data-test-id='platform-javascript-react']")
        self.browser.click('[data-test-id="create-project"]')
        self.browser.wait_until(xpath="//h2[text()='Configure React SDK']")

    @pytest.mark.skip(reason="flaky: #93634")
    def test_project_deletion_on_going_back(self):
        self.create_team(organization=self.org, name="team three")
        self.load_project_creation_page()
        self.browser.click("[data-test-id='platform-php-laravel']")
        self.browser.click('[data-test-id="create-project"]')
        self.browser.wait_until(xpath="//h2[text()='Configure Laravel SDK']")
        project1 = Project.objects.get(organization=self.org, slug="php-laravel")
        self.browser.click('[aria-label="Back to Platform Selection"]')
        self.browser.click("[data-test-id='platform-javascript-nextjs']")
        self.browser.click('[data-test-id="create-project"]')
        self.browser.wait_until(xpath="//h2[text()='Configure Next.js SDK']")
        project2 = Project.objects.get(organization=self.org, slug="javascript-nextjs")
        self.browser.back()
        self.browser.get("/organizations/%s/projects/" % self.org.slug)
        self.browser.wait_until(xpath='//h1[text()="Remain Calm"]')
        assert_existing_projects_status(
            self.org, active_project_ids=[], deleted_project_ids=[project1.id, project2.id]
        )
