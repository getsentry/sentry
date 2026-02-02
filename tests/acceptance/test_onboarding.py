import pytest

from sentry.models.project import Project
from sentry.testutils.asserts import assert_existing_projects_status
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test

pytestmark = pytest.mark.sentry_metrics


@no_silo_test
class OrganizationOnboardingTest(AcceptanceTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.member = self.create_member(
            user=self.user, organization=self.org, role="owner", teams=[self.team]
        )
        self.login_as(self.user)

    def start_onboarding(self) -> None:
        self.browser.get("/onboarding/%s/" % self.org.slug)
        self.browser.wait_until('[data-test-id="onboarding-step-welcome"]')
        self.browser.click('[data-test-id="onboarding-welcome-start"]')
        self.browser.wait_until('[data-test-id="onboarding-step-select-platform"]')

    def test_onboarding_happy_path(self) -> None:
        self.start_onboarding()
        self.browser.click('[data-test-id="platform-javascript-react"]')
        self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')
        project = Project.objects.get(organization=self.org, slug="javascript-react")
        assert project.name == "javascript-react"
        assert project.platform == "javascript-react"
        assert_existing_projects_status(
            self.org, active_project_ids=[project.id], deleted_project_ids=[]
        )

    def test_project_deletion_on_going_back(self) -> None:
        self.start_onboarding()
        self.browser.click('[data-test-id="platform-javascript-nextjs"]')
        self.browser.wait_until(xpath='//h2[text()="Configure Next.js SDK"]')
        project1 = Project.objects.get(organization=self.org, slug="javascript-nextjs")
        assert project1.name == "javascript-nextjs"
        assert project1.platform == "javascript-nextjs"
        self.browser.click('[aria-label="Back"]')
        self.browser.click('[data-test-id="platform-javascript-react"]')
        self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')
        project2 = Project.objects.get(organization=self.org, slug="javascript-react")
        assert project2.name == "javascript-react"
        assert project2.platform == "javascript-react"
        self.browser.back()
        self.browser.click(xpath='//a[text()="Skip Onboarding"]')
        self.browser.get("/organizations/%s/projects/" % self.org.slug)
        self.browser.wait_until(xpath='//h1[text()="Remain Calm"]')
        assert_existing_projects_status(
            self.org, active_project_ids=[], deleted_project_ids=[project1.id, project2.id]
        )

    def test_framework_modal_open_by_selecting_vanilla_platform(self) -> None:
        self.start_onboarding()
        self.browser.click('[data-test-id="platform-javascript"]')
        self.browser.wait_until(xpath='//h6[text()="Do you use a framework?"]')
        self.browser.click('[aria-label="Close Modal"]')
        assert not self.browser.element_exists('[aria-label="Clear"]')
        self.browser.click('[data-test-id="platform-javascript"]')
        self.browser.click('[aria-label="Configure SDK"]')
        self.browser.wait_until(xpath='//h2[text()="Configure Browser JavaScript SDK"]')
        project = Project.objects.get(organization=self.org, slug="javascript")
        assert project.name == "javascript"
        assert project.platform == "javascript"
        assert_existing_projects_status(
            self.org, active_project_ids=[project.id], deleted_project_ids=[]
        )

    def test_create_delete_create_same_platform(self) -> None:
        "This test ensures that the regression fixed in PR https://github.com/getsentry/sentry/pull/87869 no longer occurs."
        self.start_onboarding()
        self.browser.click('[data-test-id="platform-javascript-nextjs"]')
        self.browser.wait_until(xpath='//h2[text()="Configure Next.js SDK"]')
        project1 = Project.objects.get(organization=self.org, slug="javascript-nextjs")
        assert project1.name == "javascript-nextjs"
        assert project1.platform == "javascript-nextjs"
        self.browser.click('[aria-label="Back"]')
        self.browser.click('[data-test-id="platform-javascript-nextjs"]')
        self.browser.wait_until(xpath='//h2[text()="Configure Next.js SDK"]')
        project2 = Project.objects.get(organization=self.org, slug="javascript-nextjs")
        assert project2.name == "javascript-nextjs"
        assert project2.platform == "javascript-nextjs"
        self.browser.click(xpath='//a[text()="Skip Onboarding"]')
        self.browser.get("/organizations/%s/projects/" % self.org.slug)
        self.browser.wait_until("[data-test-id='javascript-nextjs']")
        assert_existing_projects_status(
            self.org, active_project_ids=[project2.id], deleted_project_ids=[project1.id]
        )
