from datetime import datetime, timezone

from django.conf import settings

from sentry.models.organizationonboardingtask import (
    OnboardingTask,
    OnboardingTaskStatus,
    OrganizationOnboardingTask,
)
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import no_silo_test


@no_silo_test
class OrganizationQuickStartTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.login_as(self.user)

    @with_feature("organizations:onboarding")
    def test_quick_start_sidebar_is_not_automatically_opened_after_project_creation(self):
        settings.PRIVACY_URL = "https://sentry.io/privacy/"
        settings.TERMS_URL = "https://sentry.io/terms/"

        # navigate to the new organization page form
        self.browser.get("/organizations/new/")

        # create new organization
        self.browser.element('input[name="name"]').send_keys("new org")
        self.browser.element('input[name="agreeTerms"]').click()
        self.browser.click('button[type="submit"]')

        # create new project
        self.browser.wait_until_test_id("platform-javascript-react")
        self.browser.click('[data-test-id="platform-javascript-react"')
        self.browser.click('button[aria-label="Create Project"]')

        # open the getting start docs for react
        self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')

        # verify that the quick start sidebar is not automatically opened
        assert not self.browser.element_exists_by_test_id("quick-start-content")

    @with_feature("organizations:onboarding")
    def test_quick_start_not_rendered_because_all_tasks_completed_and_overdue(self):
        # Record tasks with all marked as COMPLETE, all overdue
        for task in list(OrganizationOnboardingTask.TASK_KEY_MAP.keys()):
            OrganizationOnboardingTask.objects.record(
                organization_id=self.organization.id,
                task=task,
                status=OnboardingTaskStatus.COMPLETE,
                date_completed=datetime(year=2024, month=12, day=25, tzinfo=timezone.utc),
            )

        # Load the organization's page
        self.browser.get(f"/organizations/{self.organization.slug}/")

        # Assert no error happen
        assert not self.browser.element_exists(xpath='//h1[text()="Oops! Something went wrong"]')

        # Check that the quick start sidebar is NOT shown
        assert not self.browser.element_exists('[aria-label="Onboarding"]')

    @with_feature("organizations:onboarding")
    def test_quick_start_rendered_because_not_all_tasks_are_done_even_if_all_overdue(self):
        for task in list(OrganizationOnboardingTask.TASK_KEY_MAP.keys()):
            # Record tasks with some marked as PENDING and others as COMPLETE, all overdue
            status = OnboardingTaskStatus.COMPLETE
            if task in [OnboardingTask.RELEASE_TRACKING, OnboardingTask.LINK_SENTRY_TO_SOURCE_CODE]:
                status = OnboardingTaskStatus.PENDING

            OrganizationOnboardingTask.objects.record(
                organization_id=self.organization.id,
                task=task,
                status=status,
                date_completed=datetime(year=2024, month=12, day=25, tzinfo=timezone.utc),
            )

        # Load the organization's page
        self.browser.get(f"/organizations/{self.organization.slug}/")

        # Assert no error happen
        assert not self.browser.element_exists(xpath='//h1[text()="Oops! Something went wrong"]')

        # Check that the quick start sidebar is shown
        assert self.browser.element_exists('[aria-label="Onboarding"]')
