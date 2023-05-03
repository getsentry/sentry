from __future__ import annotations

from typing import List

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOTFOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GLOBAL_PARAMS, MONITOR_PARAMS
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models import ProjectKey
from sentry.monitors.models import MonitorCheckIn
from sentry.monitors.serializers import MonitorCheckInSerializerResponse

from .base import MonitorEndpoint


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class OrganizationMonitorCheckInIndexEndpoint(MonitorEndpoint):
    public = {"GET"}

    @extend_schema(
        operation_id="Retrieve check-ins for a monitor",
        parameters=[
            GLOBAL_PARAMS.ORG_SLUG,
            MONITOR_PARAMS.MONITOR_SLUG,
            MONITOR_PARAMS.CHECKIN_ID,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "CheckInList", List[MonitorCheckInSerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
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

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
