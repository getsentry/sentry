from sentry.models.organizationonboardingtask import OrganizationOnboardingTask
from sentry.onboarding_tasks.base import OnboardingTaskBackend


class OrganizationOnboardingTaskBackend(OnboardingTaskBackend):
    MODEL = OrganizationOnboardingTask

    def fetch_onboarding_tasks(self, organization, user):
        return self.MODEL.objects.filter(organization=organization).select_related("user")

    def create_or_update_onboarding_task(self, organization, user, task, values):
        return self.MODEL.create_or_update(
            organization=organization,
            task=task,
            values=values,
            defaults={"user_id": user.id},
        )
