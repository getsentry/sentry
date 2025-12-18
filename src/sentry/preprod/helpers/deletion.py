from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING

from django.db import router, transaction
from sentry_protos.snuba.v1.endpoint_delete_trace_items_pb2 import DeleteTraceItemsRequest
from sentry_protos.snuba.v1.request_common_pb2 import (
    RequestMeta,
    TraceItemFilterWithType,
    TraceItemType,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.models.files.file import File
from sentry.preprod.models import (
    InstallablePreprodArtifact,
    PreprodArtifact,
    PreprodArtifactSizeMetrics,
)
from sentry.utils import snuba_rpc

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class PreprodFilestoreFileType(str, Enum):
    """Types of files associated with preprod artifacts."""

    MAIN_ARTIFACT = "main_artifact"
    INSTALLABLE_APP = "installable_app"
    SIZE_ANALYSIS = "size_analysis"


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
    """
    Delete an artifact and all files and related objects with detailed logging.
    This operation is atomic - either all deletions succeed or none do.
    """

    with transaction.atomic(using=router.db_for_write(PreprodArtifact)):
        files_deleted: list[str] = []

        # Delete the main artifact file
        if preprod_artifact.file_id:
            _delete_file_if_exists(
                file_id=preprod_artifact.file_id,
                file_type=PreprodFilestoreFileType.MAIN_ARTIFACT,
                artifact_id=artifact_id,
                files_deleted=files_deleted,
            )

        # Delete the installable app file (IPA/APK)
        if preprod_artifact.installable_app_file_id:
            _delete_file_if_exists(
                file_id=preprod_artifact.installable_app_file_id,
                file_type=PreprodFilestoreFileType.INSTALLABLE_APP,
                artifact_id=artifact_id,
                files_deleted=files_deleted,
            )

        # Delete size analysis metrics and their associated files
        size_metrics: list[PreprodArtifactSizeMetrics] = list(
            PreprodArtifactSizeMetrics.objects.filter(preprod_artifact=preprod_artifact)
        )
        size_metrics_count = len(size_metrics)

        for size_metric in size_metrics:
            if size_metric.analysis_file_id:
                _delete_file_if_exists(
                    file_id=size_metric.analysis_file_id,
                    file_type=PreprodFilestoreFileType.SIZE_ANALYSIS,
                    artifact_id=artifact_id,
                    files_deleted=files_deleted,
                    extra_fields={"size_metric_id": size_metric.id},
                )

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

        # Delete from EAP (Snuba)
        _delete_preprod_artifact_from_eap(
            organization_id=preprod_artifact.project.organization_id,
            project_id=preprod_artifact.project.id,
            preprod_artifact_id=preprod_artifact.id,
            artifact_id=artifact_id,
        )

        # Delete the artifact record (related objects already explicitly deleted above)
        preprod_artifact.delete()

        return ArtifactDeletionResult(
            files_deleted=files_deleted,
            installable_count=installable_count,
            size_metrics_count=size_metrics_count,
        )


def _delete_file_if_exists(
    file_id: int,
    file_type: PreprodFilestoreFileType,
    artifact_id: int,
    files_deleted: list[str],
    extra_fields: dict[str, int | str] | None = None,
) -> None:
    """Helper to delete a file with consistent error handling and logging."""
    extra = {
        "artifact_id": artifact_id,
        "file_id": file_id,
        "file_type": file_type,
        **(extra_fields or {}),
    }

    try:
        file = File.objects.get(id=file_id)
        file.delete()
        files_deleted.append(f"{file_type}_file:{file_id}")
        logger.info("preprod_artifact.admin_batch_delete.file_deleted", extra=extra)
    except File.DoesNotExist:
        logger.warning("preprod_artifact.admin_batch_delete.file_not_found", extra=extra)
        # Continue - orphaned file reference, artifact can still be deleted
    except Exception as e:
        logger.warning(
            "preprod_artifact.admin_batch_delete.file_delete_failed",
            extra={**extra, "error": str(e)},
        )
        raise


def _delete_preprod_artifact_from_eap(
    organization_id: int,
    project_id: int,
    preprod_artifact_id: int,
    artifact_id: int,
) -> None:
    """Delete preprod size metrics from EAP for the given artifact."""
    try:
        artifact_filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="preprod_artifact_id", type=AttributeKey.TYPE_INT),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_int=preprod_artifact_id),
            )
        )

        request = DeleteTraceItemsRequest(
            meta=RequestMeta(
                referrer="preprod.artifact.delete",
                cogs_category="preprod_size_analysis",
                organization_id=organization_id,
                project_ids=[project_id],
                trace_item_type=TraceItemType.TRACE_ITEM_TYPE_PREPROD,
            ),
            filters=[
                TraceItemFilterWithType(
                    item_type=TraceItemType.TRACE_ITEM_TYPE_PREPROD,
                    filter=artifact_filter,
                )
            ],
        )
        snuba_rpc.delete_trace_items_rpc(request)

        logger.info(
            "preprod_artifact.admin_batch_delete.eap_deleted",
            extra={
                "artifact_id": artifact_id,
                "preprod_artifact_id": preprod_artifact_id,
            },
        )
    except Exception as e:
        logger.warning(
            "preprod_artifact.admin_batch_delete.eap_delete_failed",
            extra={
                "artifact_id": artifact_id,
                "preprod_artifact_id": preprod_artifact_id,
                "error": str(e),
            },
        )
        # Don't raise - EAP deletion failure shouldn't block artifact deletion
        # Data will be cleaned up by retention_days TTL
