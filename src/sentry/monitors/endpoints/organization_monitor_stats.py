from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.monitors.models import Monitor

from .base import MonitorEndpoint
from .base_monitor_stats import MonitorStatsMixin


@cell_silo_endpoint
class OrganizationMonitorStatsEndpoint(MonitorEndpoint, MonitorStatsMixin):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.CRONS

    def get(
        self, request: Request, organization: Organization, project: Project, monitor: Monitor
    ) -> Response:
        return self.get_monitor_stats(request, project, monitor)
