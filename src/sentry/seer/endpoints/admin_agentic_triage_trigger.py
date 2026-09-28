from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, internal_cell_silo_endpoint
from sentry.api.permissions import StaffPermission
from sentry.tasks.seer.agentic_triage.cron import (
    SeerAgenticTriageRunOptionsPartial,
    run_agentic_triage_for_org,
    schedule_agentic_triage,
)


@internal_cell_silo_endpoint
class SeerAdminAgenticTriageTriggerEndpoint(Endpoint):
    owner = ApiOwner.ML_AI
    permission_classes = (StaffPermission,)
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request) -> Response:
        organization_id: int | None
        if "organization_id" not in request.data:
            organization_id = None
        else:
            try:
                organization_id = int(request.data["organization_id"])
            except (ValueError, TypeError):
                return Response({"detail": "organization_id must be a valid integer"}, status=400)

        dry_run = bool(request.data.get("dry_run", False))

        max_candidates_raw = request.data.get("max_candidates")
        max_candidates: int | None
        if max_candidates_raw is None or max_candidates_raw == "":
            max_candidates = None
        else:
            try:
                max_candidates = int(max_candidates_raw)
            except (ValueError, TypeError):
                return Response({"detail": "max_candidates must be a valid integer"}, status=400)
            if max_candidates < 1:
                return Response({"detail": "max_candidates must be >= 1"}, status=400)

        options: SeerAgenticTriageRunOptionsPartial = {"source": "manual", "dry_run": dry_run}
        if max_candidates is not None:
            options["max_candidates"] = max_candidates

        if organization_id is None:
            schedule_agentic_triage.apply_async(kwargs={"run_options": options})
        else:
            run_agentic_triage_for_org.apply_async(
                args=[organization_id],
                kwargs={"options": options, "execute_in_task": True},
            )

        return Response(
            {
                "success": True,
                "organization_id": organization_id,
                "dry_run": dry_run,
                "max_candidates": max_candidates,
            }
        )
