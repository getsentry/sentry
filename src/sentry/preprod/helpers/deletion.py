from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING

from django.db import router, transaction

from sentry.models.files.file import File
from sentry.preprod.models import (
    InstallablePreprodArtifact,
    PreprodArtifact,
    PreprodArtifactSizeMetrics,
)

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


@dataclass
class ArtifactDeletionResult:
    """Result of deleting a preprod artifact and its related objects."""

    files_deleted: list[str]
    """List of deleted file identifiers (e.g., 'main_file:123', 'installable_file:456')"""

    installable_count: int
    """Number of installable artifacts deleted"""

    size_metrics_count: int
    """Number of size metrics deleted"""


def delete_artifact_and_related_objects(
    preprod_artifact: PreprodArtifact, artifact_id: int
) -> ArtifactDeletionResult:
    """Delete an artifact and all files and related objects with detailed logging.

    This operation is atomic - either all deletions succeed or none do.

    Args:
        preprod_artifact: The artifact to delete
        artifact_id: Artifact ID for logging

    Returns:
        ArtifactDeletionResult containing deletion counts and file identifiers

    Raises:
        Exception: If any deletion operation fails, entire transaction is rolled back
    """

    with transaction.atomic(using=router.db_for_write(PreprodArtifact)):
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

        # Delete the artifact record (related objects already explicitly deleted above)
        preprod_artifact.delete()

        return ArtifactDeletionResult(
            files_deleted=files_deleted,
            installable_count=installable_count,
            size_metrics_count=size_metrics_count,
        )
