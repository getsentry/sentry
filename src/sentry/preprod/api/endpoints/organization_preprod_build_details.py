from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.preprod.analytics import PreprodArtifactApiGetBuildDetailsEvent
from sentry.preprod.api.bases.preprod_artifact_endpoint import PreprodArtifactResourceDoesNotExist
from sentry.preprod.api.models.project_preprod_build_details_models import (
    transform_preprod_artifact_to_build_details,
)
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.quotas import get_size_retention_cutoff

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationPreprodBuildDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization: Organization, artifact_id: str) -> Response:
        analytics.record(
            PreprodArtifactApiGetBuildDetailsEvent(
                organization_id=organization.id,
                project_id=0,
                user_id=request.user.id,
                artifact_id=artifact_id,
            )
        )

        if not features.has(
            "organizations:preprod-frontend-routes", organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        try:
            artifact = PreprodArtifact.objects.select_related(
                "mobile_app_info", "build_configuration", "project", "commit_comparison"
            ).get(
                id=int(artifact_id),
                project__organization_id=organization.id,
            )
        except (PreprodArtifact.DoesNotExist, ValueError):
            raise PreprodArtifactResourceDoesNotExist

        cutoff = get_size_retention_cutoff(organization)
        if artifact.date_added < cutoff:
            return Response({"detail": "This build's size data has expired."}, status=404)

        if artifact.state == PreprodArtifact.ArtifactState.FAILED:
            return Response({"detail": artifact.error_message}, status=400)

        build_details = transform_preprod_artifact_to_build_details(artifact)
        return Response(build_details.dict())
