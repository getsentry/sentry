from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.models.project import Project
from sentry.preprod.analytics import PreprodArtifactApiRerunStatusChecksEvent
from sentry.preprod.api.bases.preprod_artifact_endpoint import PreprodArtifactEndpoint
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.vcs.status_checks.size.tasks import create_preprod_status_check_task

logger = logging.getLogger(__name__)


@region_silo_endpoint
class PreprodArtifactRerunStatusChecksEndpoint(PreprodArtifactEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(
        self,
        request: Request,
        project: Project,
        head_artifact_id: int,
        head_artifact: PreprodArtifact,
    ) -> Response:
        """
        Re-run status checks for a specific preprod artifact.

        This endpoint re-triggers the status check posting to GitHub without
        re-running the full analysis pipeline. Useful for recovering from
        transient GitHub API errors.
        """

        check_type = request.data.get("check_type", "size")

        if check_type != "size":
            return Response(
                {"error": f"Invalid check_type: {check_type}. Only 'size' is currently supported."},
                status=400,
            )

        if not head_artifact.commit_comparison:
            return Response(
                {"error": "Cannot create status check: artifact has no commit comparison."},
                status=400,
            )

        analytics.record(
            PreprodArtifactApiRerunStatusChecksEvent(
                organization_id=project.organization_id,
                project_id=project.id,
                user_id=request.user.id,
                artifact_id=str(head_artifact.id),
                check_type=check_type,
            )
        )

        try:
            create_preprod_status_check_task.delay(preprod_artifact_id=head_artifact.id)
        except Exception:
            logger.exception(
                "preprod_artifact.rerun_status_checks.task_error",
                extra={
                    "artifact_id": head_artifact.id,
                    "user_id": request.user.id,
                    "organization_id": head_artifact.project.organization_id,
                    "project_id": head_artifact.project.id,
                    "check_type": check_type,
                },
            )
            return Response(
                {
                    "error": f"Failed to queue status check task for artifact {head_artifact.id}",
                },
                status=500,
            )

        logger.info(
            "preprod_artifact.rerun_status_checks",
            extra={
                "artifact_id": head_artifact.id,
                "user_id": request.user.id,
                "organization_id": head_artifact.project.organization_id,
                "project_id": head_artifact.project.id,
                "check_type": check_type,
            },
        )

        return Response(
            {
                "success": True,
                "artifact_id": str(head_artifact.id),
                "message": f"Status check rerun initiated for artifact {head_artifact.id}",
                "check_type": check_type,
            },
            status=202,
        )
