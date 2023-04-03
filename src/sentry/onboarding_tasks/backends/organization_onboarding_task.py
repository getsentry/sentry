from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from sentry.models import OnboardingTaskStatus, OrganizationOnboardingTask, OrganizationOption
from sentry.onboarding_tasks.base import OnboardingTaskBackend
from sentry.utils import json


class OrganizationOnboardingTaskBackend(OnboardingTaskBackend):
    Model = OrganizationOnboardingTask

    def fetch_onboarding_tasks(self, organization, user):
        return self.Model.objects.filter(organization=organization)

    def create_or_update_onboarding_task(self, organization, user, task, values):
        return self.Model.objects.create_or_update(
            organization=organization,
            task=task,
            values=values,
            defaults={"user_id": user.id},
        )

    def try_mark_onboarding_complete(self, organization_id):
        if OrganizationOption.objects.filter(
            organization_id=organization_id, key="onboarding:complete"
        ).exists():
            return

        completed = set(
            OrganizationOnboardingTask.objects.filter(
                Q(organization_id=organization_id)
                & (Q(status=OnboardingTaskStatus.COMPLETE) | Q(status=OnboardingTaskStatus.SKIPPED))
            ).values_list("task", flat=True)
        )
        if completed >= OrganizationOnboardingTask.REQUIRED_ONBOARDING_TASKS:
            try:
                with transaction.atomic():
                    OrganizationOption.objects.create(
                        organization_id=organization_id,
                        key="onboarding:complete",
                        value={"updated": json.datetime_to_str(timezone.now())},
                    )
            except IntegrityError:
                pass
