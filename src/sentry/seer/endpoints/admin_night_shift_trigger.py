from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, internal_cell_silo_endpoint
from sentry.api.permissions import StaffPermission
from sentry.tasks.seer.night_shift.cron import run_night_shift_for_org


@internal_cell_silo_endpoint
class SeerAdminNightShiftTriggerEndpoint(Endpoint):
    owner = ApiOwner.ML_AI
    permission_classes = (StaffPermission,)
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request) -> Response:
        organization_id = request.data.get("organization_id")
        if organization_id is None:
            return Response({"detail": "organization_id is required"}, status=400)

        try:
            organization_id = int(organization_id)
        except (ValueError, TypeError):
            return Response({"detail": "organization_id must be a valid integer"}, status=400)

        run_night_shift_for_org.apply_async(args=[organization_id])

        return Response(
            {
                "success": True,
                "organization_id": organization_id,
            }
        )
