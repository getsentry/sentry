from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint

from .base import ProjectMonitorCheckinEndpoint
from .base_monitor_checkin_attachment import (
    BaseMonitorCheckInAttachmentEndpoint,
    MonitorCheckInAttachmentPermission,
)


@region_silo_endpoint
class ProjectMonitorCheckInAttachmentEndpoint(
    ProjectMonitorCheckinEndpoint, BaseMonitorCheckInAttachmentEndpoint
):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.CRONS
    permission_classes = (MonitorCheckInAttachmentPermission,)

    def get(self, request: Request, project, monitor, checkin) -> Response:
        return self.get_monitor_checkin_attachment(request, project, monitor, checkin)
