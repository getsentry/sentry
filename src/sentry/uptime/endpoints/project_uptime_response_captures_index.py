from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams, UptimeParams
from sentry.models.project import Project
from sentry.uptime.endpoints.bases import ProjectUptimeAlertEndpoint
from sentry.uptime.models import UptimeResponseCapture, get_uptime_subscription
from sentry.workflow_engine.models import Detector


@region_silo_endpoint
class ProjectUptimeResponseCapturesIndexEndpoint(ProjectUptimeAlertEndpoint):
    owner = ApiOwner.CRONS
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }

    @extend_schema(
        operation_id="Delete All Uptime Response Captures",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            UptimeParams.UPTIME_ALERT_ID,
        ],
        responses={
            200: dict,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(
        self,
        request: Request,
        project: Project,
        uptime_detector: Detector,
    ) -> Response:
        """
        Delete all captured HTTP responses for an uptime monitor.
        """
        uptime_subscription = get_uptime_subscription(uptime_detector)

        # Delete each capture individually to trigger File cleanup via delete() override
        deleted_count = 0
        for capture in UptimeResponseCapture.objects.filter(
            uptime_subscription=uptime_subscription
        ):
            capture.delete()
            deleted_count += 1

        return Response({"deletedCount": deleted_count})
