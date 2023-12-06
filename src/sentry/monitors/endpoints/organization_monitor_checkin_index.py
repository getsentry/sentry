from __future__ import annotations

from typing import List

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams, MonitorParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.projectkey import ProjectKey
from sentry.monitors.models import MonitorCheckIn
from sentry.monitors.serializers import MonitorCheckInSerializer, MonitorCheckInSerializerResponse

from .base import MonitorEndpoint


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class OrganizationMonitorCheckInIndexEndpoint(MonitorEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.CRONS

    @extend_schema(
        operation_id="Retrieve Check-Ins for a Monitor",
        parameters=[
            GlobalParams.ORG_SLUG,
            MonitorParams.MONITOR_SLUG,
            MonitorParams.CHECKIN_ID,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "CheckInList", List[MonitorCheckInSerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization, project, monitor) -> Response:
        """
        Retrieve a list of check-ins for a monitor
        """
        # we don't allow read permission with DSNs
        if isinstance(request.auth, ProjectKey):
            return self.respond(status=401)

        start, end = get_date_range_from_params(request.GET)
        if start is None or end is None:
            raise ParseError(detail="Invalid date range")

        queryset = MonitorCheckIn.objects.filter(
            monitor_id=monitor.id,
            date_added__gte=start,
            date_added__lte=end,
        )

        environments = get_environments(request, organization)

        if environments:
            queryset = queryset.filter(monitor_environment__environment__in=environments)

        expand: List[str] = request.GET.getlist("expand", [])

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            on_results=lambda x: serialize(
                x,
                request.user,
                MonitorCheckInSerializer(
                    start=start,
                    end=end,
                    expand=expand,
                    organization_id=organization.id,
                    project_id=project.id,
                ),
            ),
            paginator_cls=OffsetPaginator,
        )
