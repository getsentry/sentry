from __future__ import annotations

import logging
from dataclasses import dataclass

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
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.utils import snuba_rpc

logger = logging.getLogger(__name__)


@dataclass
class ArtifactDeletionResult:
    """Result of deleting preprod artifacts and their related objects."""

    size_metrics_deleted: int
    """Number of size metrics deleted"""

    installable_artifacts_deleted: int
    """Number of installable artifacts deleted"""

    artifacts_deleted: int
    """Number of artifacts deleted"""

    files_deleted: int
    """Total number of files deleted"""


def bulk_delete_artifacts_and_related_data(
    preprod_artifact_ids: list[int],
) -> ArtifactDeletionResult:
    """
    Bulk delete preprod artifacts and all related data.
    """
    if not preprod_artifact_ids:
        return ArtifactDeletionResult(
            size_metrics_deleted=0,
            installable_artifacts_deleted=0,
            artifacts_deleted=0,
            files_deleted=0,
        )

    artifact_data = PreprodArtifact.objects.filter(id__in=preprod_artifact_ids).values(
        "id", "file_id", "installable_app_file_id", "app_icon_id"
    )

    size_metrics = PreprodArtifactSizeMetrics.objects.filter(
        preprod_artifact_id__in=preprod_artifact_ids
    ).values("analysis_file_id")

    all_file_ids = []
    for artifact in artifact_data:
        if artifact["file_id"]:
            all_file_ids.append(artifact["file_id"])
        if artifact["installable_app_file_id"]:
            all_file_ids.append(artifact["installable_app_file_id"])
        if artifact["app_icon_id"]:
            try:
                all_file_ids.append(int(artifact["app_icon_id"]))
            except (ValueError, TypeError):
                pass

    for sm in size_metrics:
        if sm["analysis_file_id"]:
            all_file_ids.append(sm["analysis_file_id"])

    files_deleted = 0
    if all_file_ids:
        try:
            files_deleted, _ = File.objects.filter(id__in=all_file_ids).delete()
        except Exception:
            logger.exception("preprod.cleanup.files_delete_failed")

    _, deleted_by_model = PreprodArtifact.objects.filter(id__in=preprod_artifact_ids).delete()

    result = ArtifactDeletionResult(
        size_metrics_deleted=deleted_by_model.get("preprod.PreprodArtifactSizeMetrics", 0),
        installable_artifacts_deleted=deleted_by_model.get("preprod.InstallablePreprodArtifact", 0),
        artifacts_deleted=deleted_by_model.get("preprod.PreprodArtifact", 0),
        files_deleted=files_deleted,
    )

    logger.info("preprod.cleanup.bulk_delete_completed", extra=result.__dict__)

    return result


def delete_artifact_and_related_objects(
    preprod_artifact: PreprodArtifact, artifact_id: int
) -> ArtifactDeletionResult:
    """
    Delete a single artifact and all its related data.
    """
    with transaction.atomic(using=router.db_for_write(PreprodArtifact)):
        result = bulk_delete_artifacts_and_related_data([preprod_artifact.id])

        _delete_preprod_data_from_eap(
            organization_id=preprod_artifact.project.organization_id,
            project_id=preprod_artifact.project.id,
            preprod_artifact_id=preprod_artifact.id,
            artifact_id=artifact_id,
        )

        return result


def _delete_preprod_data_from_eap(
    organization_id: int,
    project_id: int,
    preprod_artifact_id: int,
    artifact_id: int,
) -> None:
    """
    Delete all preprod data (both size metrics and build distribution) from EAP for the given artifact.
    """
    try:
        artifact_id_filter = ComparisonFilter(
            key=AttributeKey(name="preprod_artifact_id", type=AttributeKey.TYPE_INT),
            op=ComparisonFilter.OP_EQUALS,
            value=AttributeValue(val_int=preprod_artifact_id),
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
                    filter=TraceItemFilter(comparison_filter=artifact_id_filter),
                )
            ],
        )
        snuba_rpc.delete_trace_items_rpc(request)
    except Exception:
        logger.exception("preprod_artifact.admin_batch_delete.eap_delete_failed")
