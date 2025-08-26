import logging

import orjson
from django.db import router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.models.files.file import File
from sentry.preprod.analytics import PreprodArtifactApiAdminBatchDeleteEvent
from sentry.preprod.models import (
    InstallablePreprodArtifact,
    PreprodArtifact,
    PreprodArtifactSizeMetrics,
)

logger = logging.getLogger(__name__)


@region_silo_endpoint
class PreprodArtifactAdminBatchDeleteEndpoint(Endpoint):
    owner = ApiOwner.EMERGE_TOOLS
    permission_classes = (SuperuserPermission,)
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def _delete_artifact_files(
        self, preprod_artifact: PreprodArtifact, artifact_id: int
    ) -> tuple[list[str], int, int]:
        """Delete all files and records associated with an artifact

        Returns:
            tuple: (files_deleted, installable_count, size_metrics_count)
                - files_deleted: List of successfully deleted items (files, records)
                - installable_count: Number of installable artifacts processed
                - size_metrics_count: Number of size metrics processed

        Raises:
            Exception: If any deletion operation fails, causing transaction rollback
        """
        files_deleted = []

        # Delete the main artifact file
        if preprod_artifact.file_id:
            try:
                main_file = File.objects.get(id=preprod_artifact.file_id)
                main_file.delete()
                files_deleted.append(f"main_file:{preprod_artifact.file_id}")
                logger.info(
                    "preprod_artifact.admin_batch_delete.file_deleted",
                    extra={
                        "artifact_id": artifact_id,
                        "file_id": preprod_artifact.file_id,
                        "file_type": "main_artifact",
                    },
                )
            except Exception as e:
                logger.warning(
                    "preprod_artifact.admin_batch_delete.file_delete_failed",
                    extra={
                        "artifact_id": artifact_id,
                        "file_id": preprod_artifact.file_id,
                        "file_type": "main_artifact",
                        "error": str(e),
                    },
                )
                raise

        # Delete the installable app file (IPA/APK)
        if preprod_artifact.installable_app_file_id:
            try:
                installable_file = File.objects.get(id=preprod_artifact.installable_app_file_id)
                installable_file.delete()
                files_deleted.append(f"installable_file:{preprod_artifact.installable_app_file_id}")
                logger.info(
                    "preprod_artifact.admin_batch_delete.file_deleted",
                    extra={
                        "artifact_id": artifact_id,
                        "file_id": preprod_artifact.installable_app_file_id,
                        "file_type": "installable_app",
                    },
                )
            except Exception as e:
                logger.warning(
                    "preprod_artifact.admin_batch_delete.file_delete_failed",
                    extra={
                        "artifact_id": artifact_id,
                        "file_id": preprod_artifact.installable_app_file_id,
                        "file_type": "installable_app",
                        "error": str(e),
                    },
                )
                raise

        # Delete size analysis metrics and their associated files
        size_metrics = list(
            PreprodArtifactSizeMetrics.objects.filter(preprod_artifact=preprod_artifact)
        )
        size_metrics_count = len(size_metrics)

        for size_metric in size_metrics:
            if size_metric.analysis_file_id:
                try:
                    analysis_file = File.objects.get(id=size_metric.analysis_file_id)
                    analysis_file.delete()
                    files_deleted.append(f"size_analysis_file:{size_metric.analysis_file_id}")
                    logger.info(
                        "preprod_artifact.admin_batch_delete.file_deleted",
                        extra={
                            "artifact_id": artifact_id,
                            "file_id": size_metric.analysis_file_id,
                            "file_type": "size_analysis",
                            "size_metric_id": size_metric.id,
                        },
                    )
                except Exception as e:
                    logger.warning(
                        "preprod_artifact.admin_batch_delete.file_delete_failed",
                        extra={
                            "artifact_id": artifact_id,
                            "file_id": size_metric.analysis_file_id,
                            "file_type": "size_analysis",
                            "size_metric_id": size_metric.id,
                            "error": str(e),
                        },
                    )
                    raise

            # Delete the size metric record itself
            try:
                size_metric.delete()
                logger.info(
                    "preprod_artifact.admin_batch_delete.size_metric_deleted",
                    extra={
                        "artifact_id": artifact_id,
                        "size_metric_id": size_metric.id,
                    },
                )
            except Exception as e:
                logger.warning(
                    "preprod_artifact.admin_batch_delete.size_metric_delete_failed",
                    extra={
                        "artifact_id": artifact_id,
                        "size_metric_id": size_metric.id,
                        "error": str(e),
                    },
                )
                raise

        # Delete installable artifacts (download links)
        installable_artifacts = InstallablePreprodArtifact.objects.filter(
            preprod_artifact=preprod_artifact
        )
        installable_count = installable_artifacts.count()
        for installable in installable_artifacts:
            try:
                installable.delete()
                logger.info(
                    "preprod_artifact.admin_batch_delete.installable_deleted",
                    extra={
                        "artifact_id": artifact_id,
                        "installable_id": installable.id,
                        "url_path": installable.url_path,
                    },
                )
            except Exception as e:
                logger.warning(
                    "preprod_artifact.admin_batch_delete.installable_delete_failed",
                    extra={
                        "artifact_id": artifact_id,
                        "installable_id": installable.id,
                        "url_path": installable.url_path,
                        "error": str(e),
                    },
                )
                raise

        return files_deleted, installable_count, size_metrics_count

    def delete(self, request: Request) -> Response:
        """
        Batch delete multiple preprod artifacts
        ````````````````````````````````````````

        Admin endpoint to delete all associated data for multiple preprod artifacts.
        This endpoint requires superuser privileges.

        This is a destructive operation that will permanently delete for each artifact:
        - The artifact record
        - All associated files
        - All related metadata

        :auth: required (superuser)
        """
        try:
            data = orjson.loads(request.body)
        except (orjson.JSONDecodeError, TypeError):
            return Response({"error": "Invalid JSON body"}, status=400)

        preprod_artifact_ids = data.get("preprod_artifact_ids")
        if not preprod_artifact_ids:
            return Response({"error": "preprod_artifact_ids is required"}, status=400)

        if not isinstance(preprod_artifact_ids, list):
            return Response({"error": "preprod_artifact_ids must be an array"}, status=400)

        try:
            preprod_artifact_ids = [int(id_val) for id_val in preprod_artifact_ids]
        except (ValueError, TypeError):
            return Response(
                {"error": "preprod_artifact_ids must contain valid integers"}, status=400
            )

        # Limit batch size for safety
        if len(preprod_artifact_ids) > 100:
            return Response({"error": "Cannot delete more than 100 artifacts at once"}, status=400)

        # Get all artifacts to be deleted
        artifacts_to_delete = list(
            PreprodArtifact.objects.select_related("project", "project__organization").filter(
                id__in=preprod_artifact_ids
            )
        )

        if not artifacts_to_delete:
            return Response({"error": "No artifacts found with the provided IDs"}, status=404)

        # Log analytics event (using the first artifact's organization/project for analytics)
        first_artifact = artifacts_to_delete[0]
        analytics.record(
            PreprodArtifactApiAdminBatchDeleteEvent(
                organization_id=first_artifact.project.organization_id,
                project_id=first_artifact.project.id,
                user_id=request.user.id,
                artifact_count=len(artifacts_to_delete),
            )
        )

        # Track deletion results
        deletion_results = []
        total_files_deleted = []
        total_size_metrics_deleted = 0
        total_installable_artifacts_deleted = 0

        # Delete each artifact
        for preprod_artifact in artifacts_to_delete:
            artifact_id = preprod_artifact.id

            try:
                organization_id = preprod_artifact.project.organization_id
                project_id = preprod_artifact.project.id

                with transaction.atomic(using=router.db_for_write(PreprodArtifact)):
                    files_deleted, installable_count, size_metrics_count = (
                        self._delete_artifact_files(preprod_artifact, artifact_id)
                    )

                    # Delete the artifact record (related objects already explicitly deleted above)
                    preprod_artifact.delete()

                total_files_deleted.extend(files_deleted)
                total_size_metrics_deleted += size_metrics_count
                total_installable_artifacts_deleted += installable_count

                deletion_results.append(
                    {
                        "artifact_id": str(artifact_id),
                        "success": True,
                        "files_deleted": files_deleted,
                        "size_metrics_deleted": size_metrics_count,
                        "installable_artifacts_deleted": installable_count,
                    }
                )

                logger.info(
                    "preprod_artifact.admin_batch_delete.artifact_deleted",
                    extra={
                        "artifact_id": artifact_id,
                        "user_id": request.user.id,
                        "organization_id": organization_id,
                        "project_id": project_id,
                        "files_deleted": files_deleted,
                        "size_metrics_deleted": size_metrics_count,
                        "installable_artifacts_deleted": installable_count,
                    },
                )

            except Exception as e:
                deletion_results.append(
                    {
                        "artifact_id": str(artifact_id),
                        "success": False,
                        "error": "Internal error deleting artifact.",
                    }
                )
                logger.exception(
                    "preprod_artifact.admin_batch_delete.artifact_delete_failed",
                    extra={
                        "artifact_id": artifact_id,
                        "user_id": request.user.id,
                        "error": str(e),
                    },
                )

        # Calculate summary
        successful_deletions = [result for result in deletion_results if result["success"]]
        failed_deletions = [result for result in deletion_results if not result["success"]]

        logger.info(
            "preprod_artifact.admin_batch_delete.completed",
            extra={
                "user_id": request.user.id,
                "requested_count": len(preprod_artifact_ids),
                "found_count": len(artifacts_to_delete),
                "successful_count": len(successful_deletions),
                "failed_count": len(failed_deletions),
                "total_files_deleted": len(total_files_deleted),
                "total_size_metrics_deleted": total_size_metrics_deleted,
                "total_installable_artifacts_deleted": total_installable_artifacts_deleted,
            },
        )

        return Response(
            {
                "success": True,
                "message": f"Batch deletion completed. {len(successful_deletions)} artifacts deleted successfully.",
                "summary": {
                    "requested_count": len(preprod_artifact_ids),
                    "found_count": len(artifacts_to_delete),
                    "successful_deletions": len(successful_deletions),
                    "failed_deletions": len(failed_deletions),
                    "total_files_deleted": len(total_files_deleted),
                    "total_size_metrics_deleted": total_size_metrics_deleted,
                    "total_installable_artifacts_deleted": total_installable_artifacts_deleted,
                },
                "results": deletion_results,
            }
        )
