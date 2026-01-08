from __future__ import annotations

from django.conf import settings
from django.http.response import HttpResponseBase
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.models.project import Project
from sentry.preprod.analytics import PreprodArtifactApiSizeAnalysisDownloadEvent
from sentry.preprod.api.bases.preprod_artifact_endpoint import PreprodArtifactEndpoint
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.size_analysis.download import (
    SizeAnalysisError,
    get_size_analysis_error_response,
    get_size_analysis_response,
)


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

        Download the size analysis results for a preprod artifact.

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
            return Response({"detail": "Feature not enabled"}, status=403)

        all_size_metrics = list(head_artifact.get_size_metrics())

        try:
            return get_size_analysis_response(all_size_metrics)
        except SizeAnalysisError as e:
            return get_size_analysis_error_response(e)
