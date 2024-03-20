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
from sentry.monitors.endpoints.base import MonitorEndpoint
from sentry.monitors.endpoints.base_monitor_environment_details import (
    MonitorEnvironmentDetailsMixin,
)
from sentry.monitors.serializers import MonitorSerializer


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class OrganizationMonitorEnvironmentDetailsEndpoint(
    MonitorEndpoint, MonitorEnvironmentDetailsMixin
):
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.CRONS

    @extend_schema(
        operation_id="Update a Monitor Environment",
        parameters=[
            GlobalParams.ORG_SLUG,
            MonitorParams.MONITOR_SLUG,
            MonitorParams.ENVIRONMENT,
        ],
        responses={
            200: MonitorSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(
        self, request: Request, organization, project, monitor, monitor_environment
    ) -> Response:
        """
        Update a monitor environment.
        """
        return self.update_monitor_environment(request, project, monitor, monitor_environment)

    @extend_schema(
        operation_id="Delete a Monitor Environments",
        parameters=[
            GlobalParams.ORG_SLUG,
            MonitorParams.MONITOR_SLUG,
            MonitorParams.ENVIRONMENT,
        ],
        responses={
            202: RESPONSE_ACCEPTED,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(
        self, request: Request, organization, project, monitor, monitor_environment
    ) -> Response:
        return self.delete_monitor_environment(request, project, monitor, monitor_environment)
