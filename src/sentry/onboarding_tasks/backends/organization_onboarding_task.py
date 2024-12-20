from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, router, transaction
from django.db.models import Q
from django.utils import timezone

from sentry import analytics, features
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization
from sentry.models.organizationonboardingtask import (
    OnboardingTaskStatus,
    OrganizationOnboardingTask,
)
from sentry.models.project import Project
from sentry.onboarding_tasks.base import OnboardingTaskBackend
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils import json
from sentry.utils.platform_categories import SOURCE_MAPS


class OrganizationOnboardingTaskBackend(OnboardingTaskBackend[OrganizationOnboardingTask]):
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

    def try_mark_onboarding_complete(
        self, organization_id: int, user: User | RpcUser | AnonymousUser
    ):
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

        organization = Organization.objects.get_from_cache(id=organization_id)
        if features.has("organizations:quick-start-updates", organization, actor=user):
            # We get the first project, because it is the one that will mark the task of creating the first project as completed
            first_project = Project.objects.filter(organization=organization).first()

            # If the first project exists and can have source maps, we make source maps required to complete the quick start
            if first_project and first_project.platform in SOURCE_MAPS:
                required_tasks = (
                    OrganizationOnboardingTask.NEW_REQUIRED_ONBOARDING_TASKS_WITH_SOURCE_MAPS
                )
            else:
                required_tasks = OrganizationOnboardingTask.NEW_REQUIRED_ONBOARDING_TASKS
        else:
            required_tasks = OrganizationOnboardingTask.REQUIRED_ONBOARDING_TASKS

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
