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
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.preprod.analytics import PreprodArtifactApiSizeAnalysisDownloadEvent
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.size_analysis.download import (
    SizeAnalysisError,
    get_size_analysis_error_response,
    get_size_analysis_response,
)

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationPreprodArtifactSizeAnalysisEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self,
        request: Request,
        organization: Organization,
        artifact_id: str,
    ) -> HttpResponseBase:
        """
        Download size analysis results for a preprod artifact by artifact ID
        ``````````````````````````````````````````````````````````````````````

        Download the size analysis results for a preprod artifact without requiring the project ID.
        The artifact ID is used to look up the associated project internally.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          artifact belongs to.
        :pparam string artifact_id: the ID of the preprod artifact to download size analysis for.
        :auth: required
        """

        if not settings.IS_DEV and not features.has(
            "organizations:preprod-frontend-routes", organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        try:
            artifact_id_int = int(artifact_id)
        except ValueError:
            return Response({"detail": f"Invalid artifact ID: {artifact_id}"}, status=400)

        try:
            preprod_artifact = PreprodArtifact.objects.select_related(
                "project",
            ).get(
                id=artifact_id_int,
                project__organization_id=organization.id,
            )
        except PreprodArtifact.DoesNotExist:
            return Response(
                {"detail": f"Artifact {artifact_id} not found in organization"}, status=404
            )

        analytics.record(
            PreprodArtifactApiSizeAnalysisDownloadEvent(
                organization_id=organization.id,
                project_id=preprod_artifact.project.id,
                user_id=request.user.id,
                artifact_id=artifact_id,
            )
        )

        all_size_metrics = list(preprod_artifact.get_size_metrics())

        try:
            return get_size_analysis_response(all_size_metrics)
        except SizeAnalysisError as e:
            return get_size_analysis_error_response(e)
