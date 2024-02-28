from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams, MonitorParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.monitors.serializers import MonitorCheckInSerializerResponse

from .base import ProjectMonitorEndpoint
from .base_monitor_checkin_index import MonitorCheckInMixin


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class ProjectMonitorCheckInIndexEndpoint(ProjectMonitorEndpoint, MonitorCheckInMixin):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.CRONS

    @extend_schema(
        operation_id="Retrieve Check-Ins for a Monitor by Project",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            MonitorParams.MONITOR_SLUG,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "CheckInList", list[MonitorCheckInSerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, project, monitor) -> Response:
        """
        Retrieve a list of check-ins for a monitor
        """
        return self.get_monitor_checkins(request, project, monitor)
