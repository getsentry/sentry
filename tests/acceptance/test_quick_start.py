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

        self.browser.get("/organizations/new/")

        self.browser.element('input[name="name"]').send_keys("new org")
        self.browser.element('input[name="agreeTerms"]').click()
        self.browser.click('button[type="submit"]')

        self.browser.wait_until_test_id("platform-javascript-react")
        self.browser.click('[data-test-id="platform-javascript-react"')
        self.browser.click('button[aria-label="Create Project"]')

        self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')

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

        self.browser.get(f"/organizations/{self.organization.slug}/")
        assert not self.browser.element_exists(xpath='//h1[text()="Oops! Something went wrong"]')
        assert not self.browser.element_exists('[aria-label="Onboarding"]')

    @with_feature("organizations:onboarding")
    def test_quick_start_renders_even_when_all_tasks_are_overdue_but_one_is_missing_to_complete(
        self,
    ):
        excluded_required_task = OnboardingTask.FIRST_TRANSACTION
        tasks_to_process = list(
            OrganizationOnboardingTask.TASK_KEY_MAP.keys() - {excluded_required_task}
        )

        for task in tasks_to_process:
            OrganizationOnboardingTask.objects.record(
                organization_id=self.organization.id,
                task=task,
                status=OnboardingTaskStatus.COMPLETE,
                date_completed=datetime(year=2024, month=12, day=25, tzinfo=timezone.utc),
            )

        self.browser.get(f"/organizations/{self.organization.slug}/")
        self.browser.wait_until('[aria-label="Onboarding"]')

    @with_feature("organizations:onboarding")
    def test_record_works_when_already_exists(self):
        OrganizationOnboardingTask.objects.create(
            organization_id=self.organization.id,
            task=OnboardingTask.FIRST_TRANSACTION,
            status=OnboardingTaskStatus.SKIPPED,
            date_completed=datetime(year=2024, month=12, day=25, tzinfo=timezone.utc),
        )

        assert not OrganizationOnboardingTask.objects.record(
            organization_id=self.organization.id,
            task=OnboardingTask.FIRST_TRANSACTION,
            status=OnboardingTaskStatus.COMPLETE,
            date_completed=datetime(year=2024, month=12, day=25, tzinfo=timezone.utc),
        )
