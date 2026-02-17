from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.models.project import Project
from sentry.preprod.analytics import PreprodArtifactApiGetBuildDetailsEvent
from sentry.preprod.api.bases.preprod_artifact_endpoint import PreprodArtifactEndpoint
from sentry.preprod.api.models.project_preprod_build_details_models import (
    transform_preprod_artifact_to_build_details,
)
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.quotas import get_size_retention_cutoff

logger = logging.getLogger(__name__)


@region_silo_endpoint
class ProjectPreprodBuildDetailsEndpoint(PreprodArtifactEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self,
        request: Request,
        project: Project,
        head_artifact_id: int,
        head_artifact: PreprodArtifact,
    ) -> Response:
        """
        Get the build details for a preprod artifact
        ````````````````````````````````````````````````````

        Get the build details for a preprod artifact.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          artifact belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to retrieve the
                                     artifact from.
        :pparam string head_artifact_id: the ID of the preprod artifact to get build details for.
        :auth: required
        """

        analytics.record(
            PreprodArtifactApiGetBuildDetailsEvent(
                organization_id=project.organization_id,
                project_id=project.id,
                user_id=request.user.id,
                artifact_id=str(head_artifact_id),
            )
        )

        if not features.has(
            "organizations:preprod-frontend-routes", project.organization, actor=request.user
        ):
            return Response({"error": "Feature not enabled"}, status=403)

        cutoff = get_size_retention_cutoff(project.organization)
        if head_artifact.date_added < cutoff:
            return Response({"detail": "This build's size data has expired."}, status=404)

        if head_artifact.state == PreprodArtifact.ArtifactState.FAILED:
            return Response({"error": head_artifact.error_message}, status=400)
        else:
            build_details = transform_preprod_artifact_to_build_details(head_artifact)
            return Response(build_details.dict())
