import pytest

from sentry.models.project import Project
from sentry.testutils.asserts import assert_existing_projects
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test

pytestmark = pytest.mark.sentry_metrics


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
        self.browser.wait_until('[data-test-id="onboarding-step-welcome"]')
        self.browser.click('[aria-label="Start"]')
        self.browser.wait_until('[data-test-id="onboarding-step-select-platform"]')

    def click_on_platform(self, platform):
        self.browser.click(f'[data-test-id="platform-{platform}"]')

    # def verify_project_creation(self, platform, heading):
    #     self.browser.wait_until(xpath=f'//h2[text()="Configure {heading} SDK"]')
    #     project = Project.objects.get(organization=self.org, slug=platform)
    #     assert project.name == platform
    #     assert project.platform == platform
    #     return project

    def test_onboarding_happy_path(self):
        self.start_onboarding()
        self.click_on_platform("javascript-react")
        self.verify_project_creation("javascript-react", "React")

    def test_project_deletion_on_going_back(self):
        self.start_onboarding()
        self.click_on_platform("javascript-nextjs")
        self.verify_project_creation("javascript-nextjs", "Next.js")
        self.browser.click('[aria-label="Back"]')
        self.click_on_platform("javascript-react")
        self.verify_project_creation("javascript-react", "React")
        self.browser.back()
        self.browser.click(xpath='//a[text()="Skip Onboarding"]')
        self.browser.get("/organizations/%s/projects/" % self.org.slug)
        self.browser.wait_until(xpath='//h1[text()="Remain Calm"]')
        assert_existing_projects(self.org, [])

    def test_framework_modal_open_by_selecting_vanilla_platform(self):
        self.start_onboarding()
        self.browser.click('[data-test-id="platform-javascript"]')
        self.browser.wait_until(xpath='//h6[text()="Do you use a framework?"]')
        self.browser.click('[aria-label="Close Modal"]')
        assert not self.browser.element_exists('[aria-label="Clear"]')
        self.browser.click('[data-test-id="platform-javascript"]')
        self.browser.click('[aria-label="Configure SDK"]')
        self.verify_project_creation("javascript", "Browser JavaScript")

    def test_create_delete_create_same_platform(self):
        "This test ensures that the regression fixed in PR https://github.com/getsentry/sentry/pull/87869 no longer occurs."
        platform = "javascript-nextjs"
        self.start_onboarding()
        self.click_on_platform(platform)
        self.browser.wait_until(xpath='//h2[text()="Configure Next.js SDK"]')
        project1 = Project.objects.get(organization=self.org, slug=platform)
        assert project1.name == platform
        assert project1.platform == platform
        self.browser.click('[aria-label="Back"]')
        self.click_on_platform(platform)
        self.browser.wait_until(xpath='//h2[text()="Configure Next.js SDK"]')
        project2 = Project.objects.get(organization=self.org, slug=platform)
        assert project2.name == platform
        assert project2.platform == platform
        self.browser.click(xpath='//a[text()="Skip Onboarding"]')
        self.browser.get("/organizations/%s/projects/" % self.org.slug)
        self.browser.wait_until(f'[data-test-id="{platform}"]')
        assert_existing_projects(self.org, [project2.id])
