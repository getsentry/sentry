from __future__ import annotations

from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import BaseEndpointMixin
from sentry.api.helpers.environments import get_environments
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params
from sentry.monitors.models import MonitorCheckIn
from sentry.monitors.serializers import MonitorCheckInSerializer


class MonitorCheckInMixin(BaseEndpointMixin):
    def get_monitor_checkins(self, request: Request, project, monitor) -> Response:
        """
        Retrieve a list of check-ins for a monitor
        """
        # we don't allow read permission with DSNs
        if request.auth is not None and request.auth.kind == "project_key":  # type: ignore[union-attr]
            return self.respond(status=401)

        start, end = get_date_range_from_params(request.GET)
        if start is None or end is None:
            raise ParseError(detail="Invalid date range")

        queryset = MonitorCheckIn.objects.filter(
            monitor_id=monitor.id,
            date_added__gte=start,
            date_added__lte=end,
        )

        environments = get_environments(request, project.organization)

        if environments:
            queryset = queryset.filter(
                monitor_environment__environment_id__in=[e.id for e in environments]
            )

        expand: list[str] = request.GET.getlist("expand", [])

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
                    organization_id=project.organization_id,
                    project_id=project.id,
                ),
            ),
            paginator_cls=OffsetPaginator,
        )
