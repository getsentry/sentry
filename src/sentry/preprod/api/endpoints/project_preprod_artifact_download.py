import posixpath

from django.http.response import FileResponse, HttpResponseBase
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.files.file import File
from sentry.preprod.authentication import LaunchpadRpcSignatureAuthentication
from sentry.preprod.models import PreprodArtifact


@region_silo_endpoint
class ProjectPreprodArtifactDownloadEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (LaunchpadRpcSignatureAuthentication,)
    permission_classes = ()

    def _is_authorized(self, request: Request) -> bool:
        if request.auth and isinstance(
            request.successful_authenticator, LaunchpadRpcSignatureAuthentication
        ):
            return True
        return False

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
        if not self._is_authorized(request):
            raise PermissionDenied

        try:
            preprod_artifact = PreprodArtifact.objects.get(
                project=project,
                id=artifact_id,
            )
        except PreprodArtifact.DoesNotExist:
            return Response({"error": f"Preprod artifact {artifact_id} not found"}, status=404)

        if preprod_artifact.file_id is None:
            return Response({"error": "Preprod artifact file not available"}, status=404)

        if preprod_artifact.state != PreprodArtifact.ArtifactState.PROCESSED:
            return Response(
                {
                    "error": f"Preprod artifact is not ready for download (state: {preprod_artifact.get_state_display()})"
                },
                status=400,
            )

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
