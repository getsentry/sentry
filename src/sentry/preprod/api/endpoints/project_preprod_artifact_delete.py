from __future__ import annotations
from typing import int

import logging

from django.db import router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.models.files.file import File
from sentry.models.project import Project
from sentry.preprod.analytics import PreprodArtifactApiDeleteEvent
from sentry.preprod.api.bases.preprod_artifact_endpoint import PreprodArtifactEndpoint
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics

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
            with transaction.atomic(using=router.db_for_write(PreprodArtifact)):
                # Delete dependent files, these do not have cascade deletes so have to do manually
                files_deleted_count = self._delete_artifact_files(head_artifact)

                # Delete the actual artifact record (this will cascade delete size metrics and installable artifacts)
                deleted_count, deleted_models = head_artifact.delete()
                size_metrics_count = deleted_models.get("preprod.PreprodArtifactSizeMetrics", 0)
                installable_count = deleted_models.get("preprod.InstallablePreprodArtifact", 0)

            logger.info(
                "preprod_artifact.deleted",
                extra={
                    "artifact_id": int(head_artifact_id),
                    "user_id": request.user.id,
                    "files_count": files_deleted_count,
                    "deleted_count": deleted_count,
                    "size_metrics_count": size_metrics_count,
                    "installable_count": installable_count,
                },
            )

            return Response(
                {
                    "success": True,
                    "message": f"Artifact {head_artifact_id} deleted successfully.",
                    "artifact_id": str(head_artifact_id),
                    "files_deleted_count": files_deleted_count,
                    "size_metrics_deleted": size_metrics_count,
                    "installable_artifacts_deleted": installable_count,
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

    def _delete_artifact_files(self, preprod_artifact: PreprodArtifact) -> int:
        file_ids_to_delete = []

        # Collect all file IDs to delete first so we can batch delete them
        if preprod_artifact.file_id:
            file_ids_to_delete.append(preprod_artifact.file_id)

        if preprod_artifact.installable_app_file_id:
            file_ids_to_delete.append(preprod_artifact.installable_app_file_id)

        # Collect size analysis file IDs
        size_metrics = PreprodArtifactSizeMetrics.objects.filter(preprod_artifact=preprod_artifact)
        for size_metric in size_metrics:
            if size_metric.analysis_file_id:
                file_ids_to_delete.append(size_metric.analysis_file_id)

        # Batch delete all files
        files_deleted_count = 0
        if file_ids_to_delete:
            files_deleted_count, _ = File.objects.filter(id__in=file_ids_to_delete).delete()

        return files_deleted_count
