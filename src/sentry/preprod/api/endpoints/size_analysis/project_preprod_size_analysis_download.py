from __future__ import annotations

import logging

from django.conf import settings
from django.http.response import HttpResponseBase
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.models.files.file import File
from sentry.models.project import Project
from sentry.preprod.analytics import PreprodArtifactApiSizeAnalysisDownloadEvent
from sentry.preprod.api.bases.preprod_artifact_endpoint import PreprodArtifactEndpoint
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.utils import json

logger = logging.getLogger(__name__)


@region_silo_endpoint
class ProjectPreprodArtifactSizeAnalysisDownloadEndpoint(PreprodArtifactEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self,
        request: Request,
        project: Project,
        head_artifact_id: str,
        head_artifact: PreprodArtifact,
    ) -> HttpResponseBase:
        """
        Download size analysis results for a preprod artifact
        ````````````````````````````````````````````````````

        Download size analysis results for a preprod artifact.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          artifact belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to retrieve the
                                     artifact from.
        :pparam string head_artifact_id: the ID of the preprod artifact to download size analysis for.
        :auth: required
        """

        analytics.record(
            PreprodArtifactApiSizeAnalysisDownloadEvent(
                organization_id=project.organization_id,
                project_id=project.id,
                user_id=request.user.id,
                artifact_id=head_artifact_id,
            )
        )

        if not settings.IS_DEV and not features.has(
            "organizations:preprod-frontend-routes", project.organization, actor=request.user
        ):
            return Response({"error": "Feature not enabled"}, status=403)

        all_size_metrics = list(head_artifact.get_size_metrics())

        if not all_size_metrics:
            return Response(
                {"error": "Size analysis results not available for this artifact"},
                status=404,
            )

        # Load the analysis file once (shared across all metrics)
        analysis_data = None
        for size_metrics in all_size_metrics:
            if (
                size_metrics.state == PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
                and size_metrics.analysis_file_id
            ):
                file_obj = File.objects.get(id=size_metrics.analysis_file_id)
                with file_obj.getfile() as fp:
                    analysis_data = json.load(fp)
                break

        all_metrics_data = []
        for size_metrics in all_size_metrics:
            metrics_data = {
                "id": size_metrics.id,
                "metrics_artifact_type": size_metrics.metrics_artifact_type,
                "identifier": size_metrics.identifier,
                "state": PreprodArtifactSizeMetrics.SizeAnalysisState(
                    size_metrics.state
                ).name.lower(),
                "min_install_size": size_metrics.min_install_size,
                "max_install_size": size_metrics.max_install_size,
                "min_download_size": size_metrics.min_download_size,
                "max_download_size": size_metrics.max_download_size,
                "processing_version": size_metrics.processing_version,
            }

            if size_metrics.state == PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED:
                metrics_data["error_code"] = size_metrics.error_code
                metrics_data["error_message"] = size_metrics.error_message or "Size analysis failed"

            all_metrics_data.append(metrics_data)

        # Determine overall state for frontend compatibility
        states = [m.state for m in all_size_metrics]
        if any(s == PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED for s in states):
            overall_state = "failed"
        elif any(s == PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING for s in states):
            overall_state = "processing"
        elif any(s == PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING for s in states):
            overall_state = "pending"
        else:
            overall_state = "completed"

        response_data = {"state": overall_state, "size_metrics": all_metrics_data}

        if analysis_data:
            response_data.update(analysis_data)

        return Response(response_data, status=200)
