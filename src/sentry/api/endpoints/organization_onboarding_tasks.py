from __future__ import absolute_import

from django.utils import timezone
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models import OnboardingTaskStatus, OrganizationOnboardingTask
from sentry.receivers import try_mark_onboarding_complete


class OrganizationOnboardingTaskEndpoint(OrganizationEndpoint):
    def post(self, request, organization):
        try:
            task_id = OrganizationOnboardingTask.TASK_LOOKUP_BY_KEY[request.data["task"]]
        except KeyError:
            return Response({"detail": "Invalid task key"}, status=422)

        status = OrganizationOnboardingTask.STATUS_LOOKUP_BY_KEY.get(request.data["status"])
        if status is None:
            return Response({"detail": "Invalid status key"}, status=422)

        # Cannot skip unskippable tasks
        if (
            status == OnboardingTaskStatus.SKIPPED
            and task_id not in OrganizationOnboardingTask.SKIPPABLE_TASKS
        ):
            return Response(status=422)

        rows_affected, created = OrganizationOnboardingTask.objects.create_or_update(
            organization=organization,
            user=request.user,
            task=task_id,
            values={"status": OnboardingTaskStatus.SKIPPED, "date_completed": timezone.now()},
        )
        if rows_affected or created:
            try_mark_onboarding_complete(organization.id)
        return Response(status=204)
