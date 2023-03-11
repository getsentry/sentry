from __future__ import annotations

from django.http.response import FileResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.authentication import DSNAuthentication
from sentry.api.base import region_silo_endpoint
from sentry.models import File

from .base import MonitorCheckInAttachmentPermission, MonitorCheckInEndpoint


@region_silo_endpoint
class OrganizationMonitorCheckInAttachmentEndpoint(MonitorCheckInEndpoint):
    # TODO(davidenwang): Add documentation after uploading feature is complete
    private = True

    # TODO: Remove DSN authentication for get
    authentication_classes = MonitorCheckInEndpoint.authentication_classes + (DSNAuthentication,)
    permission_classes = (MonitorCheckInAttachmentPermission,)

    def download(self, file_id):
        file = File.objects.get(id=file_id)
        fp = file.getfile()
        response = FileResponse(
            fp,
            content_type=file.headers.get("Content-Type", "application/octet-stream"),
        )
        response["Content-Length"] = file.size
        response["Content-Disposition"] = f"attachment; filename={file.name}"
        return response

    def get(self, request: Request, project, monitor, checkin) -> Response:
        if checkin.attachment_id:
            return self.download(checkin.attachment_id)
        else:
            return Response({"detail": "Check-in has no attachment"}, status=404)
