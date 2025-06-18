import logging
import posixpath

from django.http.response import HttpResponseBase, StreamingHttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.models.files.file import File
from sentry.preprod.models import PreprodArtifact

logger = logging.getLogger(__name__)


@region_silo_endpoint
class ProjectPreprodArtifactDetailsEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (ProjectReleasePermission,)

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
        logger.info(
            "preprod_artifact.download.request",
            extra={
                "project_id": project.id,
                "artifact_id": artifact_id,
                "user_id": getattr(request.user, "id", None),
                "method": request.method,
                "path": request.path,
            },
        )

        try:
            preprod_artifact = PreprodArtifact.objects.get(
                project=project,
                id=artifact_id,
            )
        except PreprodArtifact.DoesNotExist:
            logger.info(
                "preprod_artifact.download.not_found",
                extra={"project_id": project.id, "artifact_id": artifact_id},
            )
            return Response({"error": f"Preprod artifact {artifact_id} not found"}, status=404)

        if preprod_artifact.file_id is None:
            logger.info(
                "preprod_artifact.download.no_file_id",
                extra={"project_id": project.id, "artifact_id": artifact_id},
            )
            return Response({"error": "Preprod artifact file not available"}, status=404)

        # TODO: implement this but for the build distribution case, rather than the launchpad case
        # if preprod_artifact.state != PreprodArtifact.ArtifactState.PROCESSED:
        #     return Response(
        #         {
        #             "error": f"Preprod artifact is not ready for download (state: {preprod_artifact.get_state_display()})"
        #         },
        #         status=400,
        #     )

        try:
            file_obj = File.objects.get(id=preprod_artifact.file_id)
        except File.DoesNotExist:
            logger.info(
                "preprod_artifact.download.file_not_found",
                extra={
                    "project_id": project.id,
                    "artifact_id": artifact_id,
                    "file_id": preprod_artifact.file_id,
                },
            )
            return Response({"error": "Preprod artifact file not found"}, status=404)

        try:
            fp = file_obj.getfile()
        except Exception as e:
            logger.exception(
                "preprod_artifact.download.getfile_error",
                extra={
                    "project_id": project.id,
                    "artifact_id": artifact_id,
                    "file_id": preprod_artifact.file_id,
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                    "user_id": getattr(request.user, "id", None),
                    "request_path": request.path,
                    "request_method": request.method,
                },
            )
            return Response({"error": "Failed to retrieve preprod artifact file"}, status=500)

        # Determine the filename - use artifact type and id if no specific name
        artifact_type = (
            preprod_artifact.get_artifact_type_display()
            if preprod_artifact.artifact_type
            else "artifact"
        )
        filename = f"preprod_{artifact_type}_{artifact_id}"

        # Add appropriate file extension based on artifact type
        if preprod_artifact.artifact_type == PreprodArtifact.ArtifactType.XCARCHIVE:
            filename += ".xcarchive"
        elif preprod_artifact.artifact_type == PreprodArtifact.ArtifactType.AAB:
            filename += ".aab"
        elif preprod_artifact.artifact_type == PreprodArtifact.ArtifactType.APK:
            filename += ".apk"

        response = StreamingHttpResponse(
            iter(lambda: fp.read(4096), b""), content_type="application/octet-stream"
        )
        response["Content-Length"] = file_obj.size
        response["Content-Disposition"] = f'attachment; filename="{posixpath.basename(filename)}"'

        return response
