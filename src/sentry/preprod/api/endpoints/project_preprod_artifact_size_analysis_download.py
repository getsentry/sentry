import posixpath

from django.conf import settings
from django.http.response import FileResponse, HttpResponseBase
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.files.file import File
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics


@region_silo_endpoint
class ProjectPreprodArtifactSizeAnalysisDownloadEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, project, artifact_id) -> HttpResponseBase:
        """
        Download size analysis results for a preprod artifact
        ````````````````````````````````````````````````````

        Download the size analysis results for a preprod artifact.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          artifact belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to retrieve the
                                     artifact from.
        :pparam string artifact_id: the ID of the preprod artifact to download size analysis for.
        :auth: required
        """

        analytics.record(
            "preprod_artifact.api.size_analysis_download",
            organization_id=project.organization_id,
            project_id=project.id,
            user_id=request.user.id,
            artifact_id=artifact_id,
        )

        if not settings.IS_DEV and not features.has(
            "organizations:preprod-artifact-assemble", project.organization, actor=request.user
        ):
            return Response({"error": "Feature not enabled"}, status=403)

        try:
            preprod_artifact = PreprodArtifact.objects.get(
                project=project,
                id=artifact_id,
            )
        except PreprodArtifact.DoesNotExist:
            return Response({"error": f"Preprod artifact {artifact_id} not found"}, status=404)

        # Look up the size metrics record for this artifact
        try:
            size_metrics = PreprodArtifactSizeMetrics.objects.get(
                preprod_artifact_id=preprod_artifact.id
            )
        except PreprodArtifactSizeMetrics.DoesNotExist:
            return Response(
                {"error": "Size analysis results not available for this artifact"}, status=404
            )

        if size_metrics.analysis_file_id is None:
            return Response(
                {"error": "Size analysis file not available for this artifact"}, status=404
            )

        try:
            file_obj = File.objects.get(id=size_metrics.analysis_file_id)
        except File.DoesNotExist:
            return Response({"error": "Size analysis file not found"}, status=404)

        try:
            fp = file_obj.getfile()
        except Exception:
            return Response({"error": "Failed to retrieve size analysis file"}, status=500)

        filename = f"size_analysis_{artifact_id}.json"
        response = FileResponse(
            fp,
            content_type="application/json",
        )

        response["Content-Length"] = file_obj.size
        response["Content-Disposition"] = f'attachment; filename="{posixpath.basename(filename)}"'

        return response
