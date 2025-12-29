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
        check_types = request.data.get("check_types", ["size"])

        if not isinstance(check_types, list):
            return Response(
                {"error": "check_types must be an array"},
                status=400,
            )

        if not check_types:
            return Response(
                {"error": "check_types must contain at least one check type"},
                status=400,
            )

        invalid_types = [ct for ct in check_types if ct != "size"]
        if invalid_types:
            return Response(
                {
                    "error": f"Invalid check_types: {invalid_types}. Only 'size' is currently supported."
                },
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
                check_types=check_types,
            )
        )

        failed_types = []
        for check_type in check_types:
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
                failed_types.append(check_type)

        if failed_types:
            return Response(
                {
                    "error": f"Failed to queue status checks for artifact {head_artifact.id}",
                    "failed_check_types": failed_types,
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
                "check_types": check_types,
            },
        )

        return Response(
            {
                "success": True,
                "artifact_id": str(head_artifact.id),
                "message": f"Status check rerun initiated for artifact {head_artifact.id}",
                "check_types": check_types,
            },
            status=202,
        )
