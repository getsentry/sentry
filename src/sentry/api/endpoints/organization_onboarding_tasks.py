from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models import OnboardingTaskStatus
from sentry.onboarding_tasks import (
    create_or_update_onboarding_task,
    get_skippable_tasks,
    get_status_lookup_by_key,
    get_task_lookup_by_key,
    try_mark_onboarding_complete,
)

TASK_LOOKUP_BY_KEY = get_task_lookup_by_key()
SKIPPABLE_TASKS = get_skippable_tasks()
STATUS_LOOKUP_BY_KEY = get_status_lookup_by_key()


class OnboardingTaskPermission(OrganizationPermission):
    scope_map = {"POST": ["org:read"]}


@region_silo_endpoint
class OrganizationOnboardingTaskEndpoint(OrganizationEndpoint):
    permission_classes = (OnboardingTaskPermission,)

    def post(self, request: Request, organization) -> Response:

        try:
            task_id = TASK_LOOKUP_BY_KEY[request.data["task"]]
        except KeyError:
            return Response({"detail": "Invalid task key"}, status=422)

        status_value = request.data.get("status")
        completion_seen = request.data.get("completionSeen")

        if status_value is None and completion_seen is None:
            return Response({"detail": "completionSeen or status must be provided"}, status=422)

        status = STATUS_LOOKUP_BY_KEY.get(status_value)

        if status_value and status is None:
            return Response({"detail": "Invalid status key"}, status=422)

        # Cannot skip unskippable tasks
        if status == OnboardingTaskStatus.SKIPPED and task_id not in SKIPPABLE_TASKS:
            return Response(status=422)

        values = {}

        if status:
            values["status"] = status
            values["date_completed"] = timezone.now()
        if completion_seen:
            values["completion_seen"] = timezone.now()

        rows_affected, created = create_or_update_onboarding_task(
            organization=organization,
            task=task_id,
            user=request.user,
            values=values,
        )

        if rows_affected or created:
            try_mark_onboarding_complete(organization.id)

        return Response(status=204)
