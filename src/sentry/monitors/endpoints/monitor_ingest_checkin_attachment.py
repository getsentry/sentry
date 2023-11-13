from __future__ import annotations

from django.core.files.uploadedfile import UploadedFile
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.serializers import serialize
from sentry.models.files.file import File

from .base import MonitorIngestEndpoint

MAX_ATTACHMENT_SIZE = 1024 * 100  # 100kb


@region_silo_endpoint
class MonitorIngestCheckinAttachmentEndpoint(MonitorIngestEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.CRONS

    def post(self, request: Request, project, monitor, checkin) -> Response:
        """
        Uploads a check-in attachment file.

        Unlike other API requests, files must be uploaded using the traditional multipart/form-data content type.
        """
        if "file" not in request.data:
            return Response({"detail": "Missing uploaded file"}, status=400)

        if checkin.attachment_id:
            return Response({"detail": "Check-in already has an attachment"}, status=400)

        fileobj = request.data["file"]
        if not isinstance(fileobj, UploadedFile):
            return Response({"detail": "Please upload a valid file object"}, status=400)

        if fileobj.size > MAX_ATTACHMENT_SIZE:
            return Response({"detail": "Please keep uploads below 100kb"}, status=400)

        headers = {"Content-Type": fileobj.content_type}

        file = File.objects.create(name=fileobj.name, type="checkin.attachment", headers=headers)
        file.putfile(fileobj)

        checkin.update(attachment_id=file.id)
        return self.respond(serialize(checkin, request.user))
