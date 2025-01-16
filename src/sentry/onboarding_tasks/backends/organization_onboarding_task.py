from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, router, transaction
from django.db.models import Q
from django.utils import timezone

from sentry import analytics
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

        projects = Project.objects.filter(organization=organization)
        project_with_source_maps = next((p for p in projects if p.platform in SOURCE_MAPS), None)

        # If a project supports source maps, we require them to complete the quick start.
        # It's possible that the first project doesn't have source maps,
        # but the second project (which users are guided to create in the "Add Sentry to other parts of the app" step) may have source maps.
        required_tasks = (
            OrganizationOnboardingTask.REQUIRED_ONBOARDING_TASKS_WITH_SOURCE_MAPS
            if project_with_source_maps
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
