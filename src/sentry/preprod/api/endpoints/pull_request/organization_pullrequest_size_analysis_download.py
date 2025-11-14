from __future__ import annotations
from typing import int

import logging

from django.http.response import HttpResponseBase
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.preprod.analytics import PreprodApiPrPageSizeAnalysisDownloadEvent
from sentry.preprod.api.bases.preprod_artifact_endpoint import PreprodArtifactResourceDoesNotExist
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.size_analysis.download import (
    SizeAnalysisError,
    get_size_analysis_error_response,
    get_size_analysis_file_response,
)

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationPullRequestSizeAnalysisDownloadEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self, request: Request, organization: Organization, artifact_id: str
    ) -> HttpResponseBase:
        """
        Download size analysis results for a preprod artifact
        ````````````````````````````````````````````````````

        Download the size analysis results for a preprod artifact. This is separate from the
        ProjectPreprodArtifactSizeAnalysisDownloadEndpoint as PR page is not tied to a project.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          artifact belongs to.
        :pparam string artifact_id: the ID of the preprod artifact to download size analysis for.
        :auth: required
        """

        analytics.record(
            PreprodApiPrPageSizeAnalysisDownloadEvent(
                organization_id=organization.id,
                user_id=request.user.id,
                artifact_id=artifact_id,
            )
        )

        if not features.has("organizations:pr-page", organization, actor=request.user):
            return Response({"error": "Feature not enabled"}, status=403)

        try:
            artifact = PreprodArtifact.objects.get(
                id=int(artifact_id),
                project__organization_id=organization.id,
            )
        except (PreprodArtifact.DoesNotExist, ValueError):
            raise PreprodArtifactResourceDoesNotExist

        try:
            size_metrics_qs = artifact.get_size_metrics()
            size_metrics_count = size_metrics_qs.count()
            if size_metrics_count == 0:
                return Response(
                    {"error": "Size analysis results not available for this artifact"},
                    status=404,
                )
            elif size_metrics_count > 1:
                return Response(
                    {"error": "Multiple size analysis results found for this artifact"},
                    status=409,
                )

            size_metrics = size_metrics_qs.first()
            if size_metrics is None or size_metrics.analysis_file_id is None:
                logger.info(
                    "preprod.size_analysis.download.no_size_metrics",
                    extra={"artifact_id": artifact_id},
                )
                return Response(
                    {"error": "Size analysis not found"},
                    status=404,
                )
            return get_size_analysis_file_response(size_metrics)
        except SizeAnalysisError as e:
            return get_size_analysis_error_response(e)
