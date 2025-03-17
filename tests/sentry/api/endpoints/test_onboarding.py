from sentry.models.organizationonboardingtask import (
    OnboardingTaskStatus,
    OrganizationOnboardingTask,
)
from sentry.testutils.cases import APITestCase


class SkipOnboardingTaskTest(APITestCase):
    endpoint = "sentry-api-0-organization-onboardingtasks"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_skip_skippable_tasks(self):
        """
        Test if the tasks marked as skippable in the new quick start are skipped
        """
        skippable_tasks = OrganizationOnboardingTask.SKIPPABLE_TASKS

        def get_skipped_tasks():
            return set(
                OrganizationOnboardingTask.objects.filter(
                    organization=self.organization, status=OnboardingTaskStatus.SKIPPED
                ).values_list("task", flat=True)
            )

        for task_id in skippable_tasks:
            # Ensure the task is not initially marked as skipped
            tasks_before = get_skipped_tasks()
            assert task_id not in tasks_before

            # Mark the task as skipped via API call
            self.get_success_response(
                self.organization.slug,
                task=OrganizationOnboardingTask.TASK_KEY_MAP.get(task_id),
                status="skipped",
            )

            # Verify the task is now marked as skipped
            tasks_after = get_skipped_tasks()
            assert task_id in tasks_after
