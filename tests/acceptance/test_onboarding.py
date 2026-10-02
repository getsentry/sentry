import pytest

from sentry.models.project import Project
from sentry.testutils.asserts import assert_existing_projects_status
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import no_silo_test

pytestmark = pytest.mark.sentry_metrics


@no_silo_test
# Needed until the frontend stops reading this flag. Remove it with the flag registration.
@with_feature("organizations:onboarding-scm-experiment")
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
        self.browser.wait_until('[data-test-id="onboarding-step-scm-connect"]')
        self.browser.click(xpath='//button[contains(., "Continue without a repo")]')
        self.browser.wait_until('[data-test-id="onboarding-step-scm-platform-features"]')

    def select_platform(self, platform: str) -> None:
        input_element = self.browser.element('input[aria-autocomplete="list"]')
        input_element.clear()
        input_element.send_keys(platform)
        selector = f'//p[@data-test-id="menu-list-item-label"][text()="{platform}"]'
        self.browser.wait_until(xpath=selector)
        self.browser.click(xpath=selector)

    def continue_to_docs(self) -> None:
        self.browser.wait_until_clickable(xpath='//button[contains(., "Continue")]')
        self.browser.click(xpath='//button[contains(., "Continue")]')

    def test_onboarding_happy_path(self) -> None:
        self.start_onboarding()
        self.select_platform("React")
        self.continue_to_docs()
        self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')
        project = Project.objects.get(organization=self.org, slug="javascript-react")
        assert project.name == "javascript-react"
        assert project.platform == "javascript-react"
        assert_existing_projects_status(
            self.org, active_project_ids=[project.id], deleted_project_ids=[]
        )

    def test_project_deletion_on_going_back(self) -> None:
        self.start_onboarding()
        self.select_platform("Next.js")
        self.continue_to_docs()
        self.browser.wait_until(xpath='//h2[text()="Configure Next.js SDK"]')
        project1 = Project.objects.get(organization=self.org, slug="javascript-nextjs")
        assert project1.name == "javascript-nextjs"
        assert project1.platform == "javascript-nextjs"
        self.browser.click('[aria-label="Back"]')
        self.browser.wait_until('[data-test-id="onboarding-step-scm-platform-features"]')
        self.select_platform("React")
        self.continue_to_docs()
        self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')
        project2 = Project.objects.get(organization=self.org, slug="javascript-react")
        assert project2.name == "javascript-react"
        assert project2.platform == "javascript-react"
        self.browser.back()
        self.browser.click(xpath='//a[contains(., "Skip setup")]')
        self.browser.get("/organizations/%s/projects/" % self.org.slug)
        self.browser.wait_until(xpath='//*[text()="Remain Calm"]')
        assert_existing_projects_status(
            self.org, active_project_ids=[], deleted_project_ids=[project1.id, project2.id]
        )

    def test_framework_modal_open_by_selecting_vanilla_platform(self) -> None:
        self.start_onboarding()
        self.select_platform("Browser JavaScript")
        self.browser.wait_until(xpath='//h6[text()="Do you use a framework?"]')
        self.browser.click('[aria-label="Close Modal"]')
        self.browser.wait_until_not(xpath='//h6[text()="Do you use a framework?"]')
        self.select_platform("Browser JavaScript")
        self.browser.click('[aria-label="Configure SDK"]')
        self.continue_to_docs()
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
        self.select_platform("Next.js")
        self.continue_to_docs()
        self.browser.wait_until(xpath='//h2[text()="Configure Next.js SDK"]')
        project1 = Project.objects.get(organization=self.org, slug="javascript-nextjs")
        assert project1.name == "javascript-nextjs"
        assert project1.platform == "javascript-nextjs"
        self.browser.click('[aria-label="Back"]')
        self.browser.wait_until('[data-test-id="onboarding-step-scm-platform-features"]')
        self.continue_to_docs()
        self.browser.wait_until(xpath='//h2[text()="Configure Next.js SDK"]')
        project2 = Project.objects.get(organization=self.org, slug="javascript-nextjs")
        assert project2.name == "javascript-nextjs"
        assert project2.platform == "javascript-nextjs"
        self.browser.click(xpath='//a[contains(., "Skip setup")]')
        self.browser.get("/organizations/%s/projects/" % self.org.slug)
        self.browser.wait_until("[data-test-id='javascript-nextjs']")
        assert_existing_projects_status(
            self.org, active_project_ids=[project2.id], deleted_project_ids=[project1.id]
        )
