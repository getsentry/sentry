from django.utils import timezone
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models import OnboardingTaskStatus, OrganizationOnboardingTask
from sentry.receivers import try_mark_onboarding_complete


class OnboardingTaskPermission(OrganizationPermission):
    scope_map = {"POST": ["org:read"]}


class OrganizationOnboardingTaskEndpoint(OrganizationEndpoint):
    permission_classes = (OnboardingTaskPermission,)

    def post(self, request, organization):
        try:
            task_id = OrganizationOnboardingTask.TASK_LOOKUP_BY_KEY[request.data["task"]]
        except KeyError:
            return Response({"detail": "Invalid task key"}, status=422)

        status_value = request.data.get("status")
        completion_seen = request.data.get("completionSeen")

        if status_value is None and completion_seen is None:
            return Response({"detail": "completionSeen or status must be provided"}, status=422)

        status = OrganizationOnboardingTask.STATUS_LOOKUP_BY_KEY.get(status_value)

        if status_value and status is None:
            return Response({"detail": "Invalid status key"}, status=422)

        # Cannot skip unskippable tasks
        if (
            status == OnboardingTaskStatus.SKIPPED
            and task_id not in OrganizationOnboardingTask.SKIPPABLE_TASKS
        ):
            return Response(status=422)

        values = {}

        if status:
            values["status"] = status
            values["date_completed"] = timezone.now()
        if completion_seen:
            values["completion_seen"] = timezone.now()

        rows_affected, created = OrganizationOnboardingTask.objects.create_or_update(
            organization=organization, task=task_id, values=values, defaults={"user": request.user}
        )

        if rows_affected or created:
            try_mark_onboarding_complete(organization.id)

        return Response(status=204)
