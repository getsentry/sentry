from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.apidocs.constants import (
    RESPONSE_ACCEPTED,
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, MonitorParams
from sentry.monitors.endpoints.base import ProjectMonitorEndpoint
from sentry.monitors.endpoints.base_monitor_details import MonitorDetailsMixin
from sentry.monitors.serializers import MonitorSerializer
from sentry.monitors.validators import MonitorValidator
from sentry.utils.auth import AuthenticatedHttpRequest


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class ProjectMonitorDetailsEndpoint(ProjectMonitorEndpoint, MonitorDetailsMixin):
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.CRONS

    @extend_schema(
        operation_id="Retrieve a Monitor for a Project",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            MonitorParams.MONITOR_SLUG,
        ],
        responses={
            200: MonitorSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, project, monitor) -> Response:
        """
        Retrieves details for a monitor.
        """
        return self.get_monitor(request, project, monitor)

    @extend_schema(
        operation_id="Update a Monitor for a Project",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            MonitorParams.MONITOR_SLUG,
        ],
        request=MonitorValidator,
        responses={
            200: MonitorSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(self, request: AuthenticatedHttpRequest, project, monitor) -> Response:
        """
        Update a monitor.
        """
        return self.update_monitor(request, project, monitor)

    @extend_schema(
        operation_id="Delete a Monitor or Monitor Environments for a Project",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            MonitorParams.MONITOR_SLUG,
            GlobalParams.ENVIRONMENT,
        ],
        request=MonitorValidator,
        responses={
            202: RESPONSE_ACCEPTED,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, project, monitor) -> Response:
        """
        Delete a monitor or monitor environments.
        """
        return self.delete_monitor(request, project, monitor)
