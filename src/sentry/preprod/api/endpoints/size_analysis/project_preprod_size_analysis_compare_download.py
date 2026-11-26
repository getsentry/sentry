from __future__ import annotations

import logging

from django.http.response import FileResponse, HttpResponseBase
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.auth.principal import acting_user_id
from sentry.models.files.file import File
from sentry.models.project import Project
from sentry.preprod.analytics import PreprodArtifactApiSizeAnalysisCompareDownloadEvent
from sentry.preprod.models import PreprodArtifactSizeComparison
from sentry.preprod.retention import is_size_analysis_expired

logger = logging.getLogger(__name__)


@cell_silo_endpoint
class ProjectPreprodArtifactSizeAnalysisCompareDownloadEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self, request: Request, project: Project, head_size_metric_id: int, base_size_metric_id: int
    ) -> HttpResponseBase:
        """
        Download size analysis comparison results for specific size metrics
        ````````````````````````````````````````````````````

        Download the size analysis comparison results for specific size metrics.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          artifact belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to retrieve the
                                     artifact from.
        :pparam string head_size_metric_id: the ID of the head size metric to download size analysis comparison for.
        :pparam string base_size_metric_id: the ID of the base size metric to download size analysis comparison for.
        :auth: required
        """

        analytics.record(
            PreprodArtifactApiSizeAnalysisCompareDownloadEvent(
                organization_id=project.organization_id,
                project_id=project.id,
                user_id=acting_user_id(request.user),
                head_size_metric_id=str(head_size_metric_id),
                base_size_metric_id=str(base_size_metric_id),
            )
        )

        logger.info(
            "preprod.size_analysis.compare.api.download",
            extra={
                "head_size_metric_id": head_size_metric_id,
                "base_size_metric_id": base_size_metric_id,
            },
        )

        try:
            comparison_obj = PreprodArtifactSizeComparison.objects.select_related(
                "head_size_analysis__preprod_artifact",
                "base_size_analysis__preprod_artifact",
            ).get(
                head_size_analysis_id=head_size_metric_id,
                base_size_analysis_id=base_size_metric_id,
                organization_id=project.organization_id,
            )
        except PreprodArtifactSizeComparison.DoesNotExist:
            logger.info(
                "preprod.size_analysis.compare.api.download.no_comparison_obj",
                extra={
                    "head_size_metric_id": head_size_metric_id,
                    "base_size_metric_id": base_size_metric_id,
                },
            )
            return Response({"detail": "Comparison not found."}, status=404)

        head_artifact = comparison_obj.head_size_analysis.preprod_artifact
        base_artifact = comparison_obj.base_size_analysis.preprod_artifact
        if head_artifact.project_id != project.id or base_artifact.project_id != project.id:
            return Response({"detail": "Comparison not found."}, status=404)

        if is_size_analysis_expired(
            head_artifact, project.organization
        ) or is_size_analysis_expired(base_artifact, project.organization):
            return Response({"detail": "This build's size data has expired."}, status=404)

        if comparison_obj.file_id is None:
            logger.info(
                "preprod.size_analysis.compare.api.download.no_file_id",
                extra={"comparison_id": comparison_obj.id},
            )
            return Response({"detail": "Comparison not found."}, status=404)

        try:
            file_obj = File.objects.get(id=comparison_obj.file_id)
        except File.DoesNotExist:
            logger.info(
                "preprod.size_analysis.compare.api.download.no_file",
                extra={"comparison_id": comparison_obj.id},
            )
            return Response({"detail": "Comparison not found."}, status=404)

        try:
            fp = file_obj.getfile()
        except Exception:
            logger.info(
                "preprod.size_analysis.compare.api.download.no_file_getfile",
                extra={"comparison_id": comparison_obj.id},
            )
            return Response({"detail": "Failed to retrieve size analysis comparison."}, status=500)

        response = FileResponse(
            fp,
            content_type="application/json",
        )
        response["Content-Length"] = str(file_obj.size)
        return response
