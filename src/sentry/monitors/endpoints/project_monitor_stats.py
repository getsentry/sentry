from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint

from .base import ProjectMonitorEndpoint
from .base_monitor_stats import MonitorStatsMixin


@region_silo_endpoint
class ProjectMonitorStatsEndpoint(ProjectMonitorEndpoint, MonitorStatsMixin):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.CRONS

    def get(self, request: Request, project, monitor) -> Response:
        return self.get_monitor_stats(request, project, monitor)
