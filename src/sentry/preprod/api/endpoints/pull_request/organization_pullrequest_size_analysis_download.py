from __future__ import annotations

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
    SizeAnalysisResultsUnavailableError,
    get_size_analysis_error_response,
    get_size_analysis_response,
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

        all_size_metrics = list(artifact.get_size_metrics())

        if not all_size_metrics:
            return Response(
                {"error": "Size analysis results not available for this artifact"},
                status=404,
            )

        try:
            return get_size_analysis_response(all_size_metrics)
        except SizeAnalysisResultsUnavailableError as e:
            logger.info(
                "preprod.size_analysis.download.no_size_metrics",
                extra={"artifact_id": artifact_id},
            )
            return get_size_analysis_error_response(e)
        except SizeAnalysisError as e:
            return get_size_analysis_error_response(e)
