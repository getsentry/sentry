from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass

from django.db import router, transaction
from sentry_protos.snuba.v1.endpoint_delete_trace_items_pb2 import DeleteTraceItemsRequest
from sentry_protos.snuba.v1.request_common_pb2 import (
    RequestMeta,
    TraceItemFilterWithType,
    TraceItemType,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue, IntArray
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


def bulk_delete_artifacts(
    preprod_artifacts: list[PreprodArtifact],
) -> ArtifactDeletionResult:
    """
    Bulk delete preprod artifacts and all related data.
    """
    if not preprod_artifacts:
        return ArtifactDeletionResult(
            size_metrics_deleted=0,
            installable_artifacts_deleted=0,
            artifacts_deleted=0,
            files_deleted=0,
        )

    preprod_artifact_ids = [artifact.id for artifact in preprod_artifacts]

    size_metrics = PreprodArtifactSizeMetrics.objects.filter(
        preprod_artifact_id__in=preprod_artifact_ids
    ).values("analysis_file_id")

    all_file_ids = []
    for artifact in preprod_artifacts:
        if artifact.file_id:
            all_file_ids.append(artifact.file_id)
        if artifact.installable_app_file_id:
            all_file_ids.append(artifact.installable_app_file_id)
        if artifact.app_icon_id:
            try:
                all_file_ids.append(int(artifact.app_icon_id))
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


def delete_artifacts_and_eap_data(
    preprod_artifacts: list[PreprodArtifact],
) -> ArtifactDeletionResult:
    """
    Delete artifacts and all their related data.
    """
    if not preprod_artifacts:
        return ArtifactDeletionResult(
            size_metrics_deleted=0,
            installable_artifacts_deleted=0,
            artifacts_deleted=0,
            files_deleted=0,
        )

    with transaction.atomic(using=router.db_for_write(PreprodArtifact)):
        result = bulk_delete_artifacts(preprod_artifacts)

        artifacts_by_project: defaultdict[tuple[int, int], list[int]] = defaultdict(list)
        for artifact in preprod_artifacts:
            key = (artifact.project.organization_id, artifact.project.id)
            artifacts_by_project[key].append(artifact.id)

        for (organization_id, project_id), artifact_ids_batch in artifacts_by_project.items():
            _delete_preprod_data_from_eap(
                organization_id=organization_id,
                project_id=project_id,
                preprod_artifact_ids=artifact_ids_batch,
            )

        return result


def _delete_preprod_data_from_eap(
    organization_id: int,
    project_id: int,
    preprod_artifact_ids: list[int],
) -> None:
    """
    Delete all preprod data (both size metrics and build distribution) from EAP for the given artifacts.
    """
    if not preprod_artifact_ids:
        return

    try:
        artifact_id_filter = ComparisonFilter(
            key=AttributeKey(name="preprod_artifact_id", type=AttributeKey.TYPE_INT),
            op=ComparisonFilter.OP_IN,
            value=AttributeValue(val_int_array=IntArray(values=preprod_artifact_ids)),
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
