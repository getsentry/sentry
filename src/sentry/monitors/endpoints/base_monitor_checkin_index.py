from __future__ import annotations

from django.db.models import Model, QuerySet
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import BaseEndpointMixin
from sentry.api.helpers.environments import get_environments
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params
from sentry.models.project import Project
from sentry.monitors.models import Monitor, MonitorCheckIn
from sentry.monitors.serializers import MonitorCheckInSerializer
from sentry.monitors.utils import get_monitor_environment_ids
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory

CHECKIN_LIST_RATE_LIMITS = RateLimitConfig(
    limit_overrides={
        "GET": {
            RateLimitCategory.IP: RateLimit(limit=60, window=60, concurrent_limit=3),
            RateLimitCategory.USER: RateLimit(limit=60, window=60, concurrent_limit=3),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=300, window=60, concurrent_limit=5),
        }
    }
)


class CheckInPaginator(DateTimePaginator):
    # Missed check-ins in different environments share a timestamp. Break ties
    # on id so the order is stable across pages.
    def build_queryset(self, value: object, is_prev: bool) -> QuerySet[Model]:
        queryset = super().build_queryset(value, is_prev)
        return queryset.order_by(*queryset.query.order_by, "id" if self._is_asc(is_prev) else "-id")


class MonitorCheckInMixin(BaseEndpointMixin):
    def get_monitor_checkins(
        self, request: Request, project: Project, monitor: Monitor
    ) -> Response:
        """
        Retrieve a list of check-ins for a monitor
        """
        start, end = get_date_range_from_params(request.GET)
        if start is None or end is None:
            raise ParseError(detail="Invalid date range")

        environments = get_environments(request, project.organization)
        queryset = MonitorCheckIn.objects.filter(
            monitor_environment_id__in=get_monitor_environment_ids(monitor, environments),
            date_added__gte=start,
            date_added__lte=end,
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
            paginator_cls=CheckInPaginator,
        )
