import posixpath

from django.http.response import FileResponse, HttpResponseBase
from rest_framework.authentication import SessionAuthentication
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import UserAuthTokenAuthentication
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.permissions import StaffPermission
from sentry.models.files.file import File
from sentry.preprod.authentication import LaunchpadRpcSignatureAuthentication
from sentry.preprod.models import PreprodArtifact


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
class ProjectPreprodArtifactDownloadEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (
        LaunchpadRpcSignatureAuthentication,
        SessionAuthentication,
        UserAuthTokenAuthentication,
    )
    permission_classes = (LaunchpadServiceOrStaffPermission,)

    def get(self, request: Request, project, artifact_id) -> HttpResponseBase:
        """
        Download a preprod artifact file
        ```````````````````````````````

        Download the actual file contents of a preprod artifact.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          artifact belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to retrieve the
                                     artifact from.
        :pparam string artifact_id: the ID of the preprod artifact to download.
        :auth: required
        """

        try:
            preprod_artifact = PreprodArtifact.objects.get(
                project=project,
                id=artifact_id,
            )
        except PreprodArtifact.DoesNotExist:
            return Response({"error": f"Preprod artifact {artifact_id} not found"}, status=404)

        if preprod_artifact.file_id is None:
            return Response({"error": "Preprod artifact file not available"}, status=404)

        try:
            file_obj = File.objects.get(id=preprod_artifact.file_id)
        except File.DoesNotExist:
            return Response({"error": "Preprod artifact file not found"}, status=404)

        try:
            fp = file_obj.getfile()
        except Exception:
            return Response({"error": "Failed to retrieve preprod artifact file"}, status=500)

        # All preprod artifacts are zip files
        filename = f"preprod_artifact_{artifact_id}.zip"

        response = FileResponse(
            fp,
            content_type="application/octet-stream",
        )

        response["Content-Length"] = file_obj.size
        response["Content-Disposition"] = f'attachment; filename="{posixpath.basename(filename)}"'

        return response
