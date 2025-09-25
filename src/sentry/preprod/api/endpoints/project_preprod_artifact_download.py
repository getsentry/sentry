from django.http.response import FileResponse, HttpResponse, HttpResponseBase
from rest_framework.authentication import SessionAuthentication
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import UserAuthTokenAuthentication
from sentry.api.base import region_silo_endpoint
from sentry.api.permissions import StaffPermission
from sentry.models.files.file import File
from sentry.preprod.api.bases.preprod_artifact_endpoint import PreprodArtifactEndpoint
from sentry.preprod.authentication import LaunchpadRpcSignatureAuthentication
from sentry.replays.lib.http import MalformedRangeHeader, UnsatisfiableRange, parse_range_header


class LaunchpadServiceOrStaffPermission(StaffPermission):
    """
    Permission that allows access for either:
    1. Valid LaunchpadRpcSignatureAuthentication (service-to-service), OR
    2. Active staff users
    """

    def has_permission(self, request: Request, view: object) -> bool:
        if (
            request.auth
            and hasattr(request, "successful_authenticator")
            and isinstance(request.successful_authenticator, LaunchpadRpcSignatureAuthentication)
        ):
            return True

        return super().has_permission(request, view)


@region_silo_endpoint
class ProjectPreprodArtifactDownloadEndpoint(PreprodArtifactEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "HEAD": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (
        LaunchpadRpcSignatureAuthentication,
        SessionAuthentication,
        UserAuthTokenAuthentication,
    )
    permission_classes = (LaunchpadServiceOrStaffPermission,)

    def _get_file_object(self, head_artifact):
        if head_artifact.file_id is None:
            return None, Response({"error": "Preprod artifact file not available"}, status=404)

        try:
            file_obj = File.objects.get(id=head_artifact.file_id)
            return file_obj, None
        except File.DoesNotExist:
            return None, Response({"error": "Preprod artifact file not found"}, status=404)

    def _get_filename(self, head_artifact):
        return f"preprod_artifact_{head_artifact.id}.zip"

    def head(self, request: Request, project, head_artifact_id, head_artifact) -> HttpResponseBase:
        file_obj, error_response = self._get_file_object(head_artifact)
        if error_response:
            return error_response

        filename = self._get_filename(head_artifact)

        response = HttpResponse()
        response["Content-Length"] = file_obj.size
        response["Content-Type"] = "application/octet-stream"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Accept-Ranges"] = "bytes"

        return response

    def get(self, request: Request, project, head_artifact_id, head_artifact) -> HttpResponseBase:
        """
        Download a preprod artifact file
        ```````````````````````````````

        Download the actual file contents of a preprod artifact.
        Supports HTTP Range requests for resumable downloads.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          artifact belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to retrieve the
                                     artifact from.
        :pparam string head_artifact_id: the ID of the preprod artifact to download.
        :auth: required
        """

        file_obj, error_response = self._get_file_object(head_artifact)
        if error_response:
            return error_response

        filename = self._get_filename(head_artifact)
        file_size = file_obj.size

        if file_size is None or file_size < 0:
            return Response({"error": "File size unavailable"}, status=500)

        range_header = request.META.get("HTTP_RANGE")
        if range_header:
            try:
                ranges = parse_range_header(range_header)
                if not ranges:
                    return HttpResponse(status=400)

                range_obj = ranges[0]

                if file_size == 0:
                    return HttpResponse(status=416)

                start, end = range_obj.make_range(file_size - 1)

                try:
                    fp = file_obj.getfile()
                    try:
                        fp.seek(start)
                        content_length = end - start + 1
                        file_content = fp.read(content_length)
                    finally:
                        fp.close()
                except Exception:
                    return Response(
                        {"error": "Failed to retrieve preprod artifact file"}, status=500
                    )

                response = HttpResponse(
                    file_content,
                    content_type="application/octet-stream",
                    status=206,
                )

                response["Content-Length"] = str(content_length)
                response["Content-Range"] = f"bytes {start}-{end}/{file_size}"
                response["Accept-Ranges"] = "bytes"
                response["Content-Disposition"] = f'attachment; filename="{filename}"'

                return response

            except (MalformedRangeHeader, UnsatisfiableRange):
                return HttpResponse(status=416)
            except (ValueError, IndexError):
                return HttpResponse(status=400)

        try:
            fp = file_obj.getfile()
        except Exception:
            return Response({"error": "Failed to retrieve preprod artifact file"}, status=500)

        file_response: HttpResponseBase = FileResponse(
            fp,
            content_type="application/octet-stream",
        )

        file_response["Content-Length"] = file_size
        file_response["Content-Disposition"] = f'attachment; filename="{filename}"'
        file_response["Accept-Ranges"] = "bytes"

        return file_response
