from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.models.project import Project
from sentry.preprod.analytics import PreprodArtifactApiDeleteEvent
from sentry.preprod.api.bases.preprod_artifact_endpoint import PreprodArtifactEndpoint
from sentry.preprod.helpers.deletion import delete_artifact_and_related_objects
from sentry.preprod.models import PreprodArtifact

logger = logging.getLogger(__name__)


@region_silo_endpoint
class ProjectPreprodArtifactDeleteEndpoint(PreprodArtifactEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }

    def delete(
        self,
        request: Request,
        project: Project,
        head_artifact_id: int,
        head_artifact: PreprodArtifact,
    ) -> Response:
        """Delete a preprod artifact and all associated data"""

        if not features.has(
            "organizations:preprod-frontend-routes", project.organization, actor=request.user
        ):
            return Response({"error": "Feature not enabled"}, status=403)

        analytics.record(
            PreprodArtifactApiDeleteEvent(
                organization_id=project.organization_id,
                project_id=project.id,
                user_id=request.user.id,
                artifact_id=str(head_artifact_id),
            )
        )

        try:
            result = delete_artifact_and_related_objects([head_artifact])

            logger.info(
                "preprod_artifact.deleted",
                extra={
                    "artifact_id": int(head_artifact_id),
                    "user_id": request.user.id,
                    "files_deleted": result.files_deleted,
                    "size_metrics_deleted": result.size_metrics_deleted,
                    "installable_artifacts_deleted": result.installable_artifacts_deleted,
                },
            )

            return Response(
                {
                    "success": True,
                    "message": f"Artifact {head_artifact_id} deleted successfully.",
                    "artifact_id": str(head_artifact_id),
                    "files_deleted_count": result.files_deleted,
                    "size_metrics_deleted": result.size_metrics_deleted,
                    "installable_artifacts_deleted": result.installable_artifacts_deleted,
                }
            )

        except Exception:
            logger.exception(
                "preprod_artifact.delete_failed",
                extra={"artifact_id": int(head_artifact_id), "user_id": request.user.id},
            )
            return Response(
                {
                    "success": False,
                    "error": "Internal error deleting artifact.",
                },
                status=500,
            )
