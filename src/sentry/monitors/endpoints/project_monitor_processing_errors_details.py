from __future__ import annotations

from uuid import UUID

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, MonitorParams
from sentry.monitors.endpoints.base import ProjectMonitorEndpoint
from sentry.monitors.processing_errors import CheckinProcessErrorsManager


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class ProjectMonitorProcessingErrorsDetailsEndpoint(ProjectMonitorEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.CRONS

    @extend_schema(
        operation_id="Delete a processing error for a Monitor",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            MonitorParams.MONITOR_ID_OR_SLUG,
            MonitorParams.PROCESSING_ERROR_ID,
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, project, monitor, uuid: str) -> Response:
        try:
            parsed_uuid = UUID(uuid)
        except ValueError:
            raise ValidationError("Invalid UUID")
        CheckinProcessErrorsManager().delete_for_monitor(monitor, parsed_uuid)
        return self.respond(status=204)
