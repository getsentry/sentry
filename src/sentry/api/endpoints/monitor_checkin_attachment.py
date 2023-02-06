from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.authentication import DSNAuthentication
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.monitor import MonitorCheckInEndpoint
from sentry.api.serializers import serialize
from sentry.models import File


@region_silo_endpoint
class MonitorCheckInAttachmentEndpoint(MonitorCheckInEndpoint):
    authentication_classes = MonitorCheckInEndpoint.authentication_classes + (DSNAuthentication,)

    def post(self, request: Request, project, monitor, checkin) -> Response:
        """
        Uploads a check-in attachment file.

        Unlike other API requests, files must be uploaded using the traditional multipart/form-data content type.
        """
        if "file" not in request.data:
            return Response({"detail": "Missing uploaded file"}, status=400)

        fileobj = request.data["file"]

        headers = {"Content-Type": fileobj.content_type}

        file = File.objects.create(name=fileobj.name, type="checkin.attachment", headers=headers)
        file.putfile(fileobj)

        checkin.update(attachment=file)
        return self.respond(serialize(checkin, request.user))
