from sentry.models.organizationonboardingtask import (
    OnboardingTask,
    OnboardingTaskStatus,
    OrganizationOnboardingTask,
)
from sentry.onboarding_tasks.backends.organization_onboarding_task import (
    OrganizationOnboardingTaskBackend,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import no_silo_test

backend = OrganizationOnboardingTaskBackend()


@no_silo_test
class OrganizationOnboardingTaskBackendTest(TestCase):
    def test_fetch_onboarding_tasks_empty_on_org(self):
        assert len(backend.fetch_onboarding_tasks(self.organization, self.user)) == 0

    def test_fetch_onboarding_tasks_with_invalid_task(self):
        OrganizationOnboardingTask.objects.create(
            organization=self.organization,
            task=max(OnboardingTask.values()) + 1,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert len(backend.fetch_onboarding_tasks(self.organization, self.user)) == 0

    def test_fetch_onboarding_tasks_with_invalid_status(self):
        OrganizationOnboardingTask.objects.create(
            organization=self.organization,
            task=OnboardingTask.FIRST_PROJECT,
            status=max(OnboardingTaskStatus.values()) + 1,
        )
        assert len(backend.fetch_onboarding_tasks(self.organization, self.user)) == 0

    def test_fetch_onboarding_tasks_with_complete(self):
        OrganizationOnboardingTask.objects.create(
            organization=self.organization,
            task=OnboardingTask.FIRST_PROJECT,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert len(backend.fetch_onboarding_tasks(self.organization, self.user)) == 1

    def test_fetch_onboarding_tasks_with_skipped(self):
        OrganizationOnboardingTask.objects.create(
            organization=self.organization,
            task=OnboardingTask.FIRST_PROJECT,
            status=OnboardingTaskStatus.SKIPPED,
        )
        assert len(backend.fetch_onboarding_tasks(self.organization, self.user)) == 1

    def test_fetch_onboarding_tasks_multiple(self):
        OrganizationOnboardingTask.objects.create(
            organization=self.organization,
            task=OnboardingTask.FIRST_PROJECT,
            status=OnboardingTaskStatus.COMPLETE,
        )
        OrganizationOnboardingTask.objects.create(
            organization=self.organization,
            task=OnboardingTask.INVITE_MEMBER,
            status=OnboardingTaskStatus.SKIPPED,
        )
        assert len(backend.fetch_onboarding_tasks(self.organization, self.user)) == 2

    def test_fetch_onboarding_tasks_multiple_filtered(self):
        OrganizationOnboardingTask.objects.create(
            organization=self.organization,
            task=OnboardingTask.FIRST_PROJECT,
            status=max(OnboardingTaskStatus.values()) + 1,
        )
        OrganizationOnboardingTask.objects.create(
            organization=self.organization,
            task=max(OnboardingTask.values()) + 1,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert len(backend.fetch_onboarding_tasks(self.organization, self.user)) == 0
