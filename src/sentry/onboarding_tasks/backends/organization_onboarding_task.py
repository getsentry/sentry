from datetime import datetime

from django.db import IntegrityError, router, transaction
from django.db.models import Q
from django.forms import model_to_dict
from django.utils import timezone

from sentry import analytics
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization
from sentry.models.organizationonboardingtask import (
    OnboardingTask,
    OnboardingTaskStatus,
    OrganizationOnboardingTask,
)
from sentry.models.project import Project
from sentry.onboarding_tasks.base import OnboardingTaskBackend
from sentry.utils import json
from sentry.utils.platform_categories import SOURCE_MAPS


class OrganizationOnboardingTaskBackend(OnboardingTaskBackend[OrganizationOnboardingTask]):
    Model = OrganizationOnboardingTask

    def fetch_onboarding_tasks(self, organization, user):
        return self.Model.objects.filter(
            organization=organization,
            task__in=OnboardingTask.values(),  # we exclude any tasks that might no longer be in the onboarding flow but still linger around in the database
            status__in=OnboardingTaskStatus.values(),  # same here but for status
        )

    def create_or_update_onboarding_task(self, organization, user, task, values):
        return self.Model.objects.create_or_update(
            organization=organization,
            task=task,
            values=values,
            defaults={"user_id": user.id},
        )

    def complete_onboarding_task(
        self,
        organization: Organization,
        task: int,
        date_completed: datetime | None = None,
        **task_kwargs,
    ) -> bool:
        # Mark the task as complete
        created = self.Model.objects.record(
            organization_id=organization.id,
            task=task,
            status=OnboardingTaskStatus.COMPLETE,
            date_completed=date_completed or timezone.now(),
            **task_kwargs,
        )

        # Check if all required tasks are complete to see if we can mark onboarding as complete
        if created:
            self.try_mark_onboarding_complete(organization.id)
        return created

    def has_completed_onboarding_task(self, organization: Organization, task: int) -> bool:
        return OrganizationOnboardingTask.objects.filter(
            organization_id=organization.id, task=task
        ).exists()

    def try_mark_onboarding_complete(self, organization_id: int):
        if OrganizationOption.objects.filter(
            organization_id=organization_id, key="onboarding:complete"
        ).exists():
            return

        completed = set(
            OrganizationOnboardingTask.objects.filter(
                Q(organization_id=organization_id)
                & (Q(status=OnboardingTaskStatus.COMPLETE) | Q(status=OnboardingTaskStatus.SKIPPED))
                & Q(
                    completion_seen__isnull=False
                )  # For a task to be considered complete, it must have been marked as seen.
            ).values_list("task", flat=True)
        )

        organization = Organization.objects.get_from_cache(id=organization_id)

        has_project_with_source_maps = Project.objects.filter(
            organization=organization, platform__in=SOURCE_MAPS
        ).exists()

        # If a project supports source maps, we require them to complete the quick start.
        # It's possible that the first project doesn't have source maps,
        # but the second project (which users are guided to create in the "Add Sentry to other parts of the app" step) may have source maps.
        required_tasks = (
            OrganizationOnboardingTask.REQUIRED_ONBOARDING_TASKS_WITH_SOURCE_MAPS
            if has_project_with_source_maps
            else OrganizationOnboardingTask.REQUIRED_ONBOARDING_TASKS
        )

        if completed >= required_tasks:
            try:
                with transaction.atomic(router.db_for_write(OrganizationOption)):
                    OrganizationOption.objects.create(
                        organization_id=organization_id,
                        key="onboarding:complete",
                        value={"updated": json.datetime_to_str(timezone.now())},
                    )
                analytics.record(
                    "onboarding.complete",
                    user_id=organization.default_owner_id,
                    organization_id=organization_id,
                    referrer="onboarding_tasks",
                )
            except IntegrityError:
                pass

    def transfer_onboarding_tasks(
        self,
        from_organization_id: int,
        to_organization_id: int,
        project: Project | None = None,
    ):
        # get a list of task IDs that already exist in the new organization
        existing_tasks_in_new_org = OrganizationOnboardingTask.objects.filter(
            organization_id=to_organization_id
        ).values_list("task", flat=True)

        # get a list of tasks to transfer from the old organization
        tasks_to_transfer = OrganizationOnboardingTask.objects.filter(
            organization=from_organization_id,
            task__in=OrganizationOnboardingTask.TRANSFERABLE_TASKS,
        ).exclude(task__in=existing_tasks_in_new_org)

        for task_to_transfer in tasks_to_transfer:
            task_dict = model_to_dict(task_to_transfer, exclude=["id", "organization", "project"])
            new_task = OrganizationOnboardingTask(
                **task_dict, organization_id=to_organization_id, project=project
            )
            new_task.save()
