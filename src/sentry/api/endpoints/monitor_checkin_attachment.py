from __future__ import annotations

from django.http.response import FileResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.authentication import DSNAuthentication
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.monitor import MonitorCheckInAttachmentPermission, MonitorCheckInEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.monitorcheckin import MonitorCheckInSerializerResponse
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_NOTFOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GLOBAL_PARAMS, MONITOR_PARAMS
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models import File

MAX_ATTACHMENT_SIZE = 1024 * 100  # 100kb


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class MonitorCheckInAttachmentEndpoint(MonitorCheckInEndpoint):
    authentication_classes = MonitorCheckInEndpoint.authentication_classes + (DSNAuthentication,)
    permission_classes = (MonitorCheckInAttachmentPermission,)
    public = {"GET", "POST"}

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

    @extend_schema(
        operation_id="Download a check-in's attachment",
        parameters=[
            GLOBAL_PARAMS.ORG_SLUG,
            MONITOR_PARAMS.MONITOR_ID,
            MONITOR_PARAMS.CHECKIN_ID,
        ],
        responses={200: OpenApiTypes.BINARY, 401: RESPONSE_UNAUTHORIZED, 404: RESPONSE_NOTFOUND},
    )
    def get(self, request: Request, project, monitor, checkin) -> Response:
        if checkin.attachment_id:
            return self.download(checkin.attachment_id)
        else:
            return Response({"detail": "Check-in has no attachment"}, status=404)

    @extend_schema(
        operation_id="Upload an attachment to a check-in",
        parameters=[
            GLOBAL_PARAMS.ORG_SLUG,
            MONITOR_PARAMS.MONITOR_ID,
            MONITOR_PARAMS.CHECKIN_ID,
        ],
        request={
            "multipart/form-data": {
                "type": "object",
                "properties": {"file": {"type": "string", "format": "binary"}},
            }
        },
        responses={
            200: inline_sentry_response_serializer(
                "MonitorCheckIn", MonitorCheckInSerializerResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            404: RESPONSE_NOTFOUND,
        },
    )
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
        if fileobj.size > MAX_ATTACHMENT_SIZE:
            return Response({"detail": "Please keep uploads below 100kb"}, status=400)

        headers = {"Content-Type": fileobj.content_type}

        file = File.objects.create(name=fileobj.name, type="checkin.attachment", headers=headers)
        file.putfile(fileobj)

        checkin.update(attachment_id=file.id)
        return self.respond(serialize(checkin, request.user))
