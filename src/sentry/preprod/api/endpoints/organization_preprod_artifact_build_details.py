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
from sentry.preprod.api.models.project_preprod_build_details_models import (
    transform_preprod_artifact_to_build_details,
)
from sentry.preprod.models import PreprodArtifact

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationPreprodArtifactBuildDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self,
        request: Request,
        organization: Organization,
        artifact_id: str,
    ) -> Response:
        """
        Get build details for a preprod artifact by artifact ID
        ````````````````````````````````````````````````````````

        Get the build details for a preprod artifact without requiring the project ID.
        The artifact ID is used to look up the associated project internally.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          artifact belongs to.
        :pparam string artifact_id: the ID of the preprod artifact to get build details for.
        :auth: required
        """

        if not features.has(
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
                "commit_comparison",
                "build_configuration",
                "mobile_app_info",
            ).get(
                id=artifact_id_int,
                project__organization_id=organization.id,
            )
        except PreprodArtifact.DoesNotExist:
            return Response(
                {"detail": f"Artifact {artifact_id} not found in organization"}, status=404
            )

        analytics.record(
            PreprodArtifactApiGetBuildDetailsEvent(
                organization_id=organization.id,
                project_id=preprod_artifact.project.id,
                user_id=request.user.id,
                artifact_id=artifact_id,
            )
        )

        if preprod_artifact.state == PreprodArtifact.ArtifactState.FAILED:
            return Response({"detail": preprod_artifact.error_message}, status=400)
        else:
            build_details = transform_preprod_artifact_to_build_details(preprod_artifact)
            return Response(build_details.dict())
