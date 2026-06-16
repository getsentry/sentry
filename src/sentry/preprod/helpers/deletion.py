from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass

import orjson
from django.db import router, transaction
from django.db.models import Q
from sentry_protos.snuba.v1.endpoint_delete_trace_items_pb2 import DeleteTraceItemsRequest
from sentry_protos.snuba.v1.request_common_pb2 import (
    RequestMeta,
    TraceItemFilterWithType,
    TraceItemType,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue, StrArray
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.models.files.file import File
from sentry.objectstore import get_preprod_session
from sentry.preprod.eap.constants import get_preprod_trace_id
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.preprod.snapshots.manifest import ComparisonManifest
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.utils import snuba_rpc
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor

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

    objectstore_keys_deleted: int = 0


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
        mobile_app_info = artifact.get_mobile_app_info()
        app_icon_id = mobile_app_info.app_icon_id if mobile_app_info else None
        if app_icon_id:
            try:
                all_file_ids.append(int(app_icon_id))
            except (ValueError, TypeError):
                pass

    for sm in size_metrics:
        if sm["analysis_file_id"]:
            all_file_ids.append(sm["analysis_file_id"])

    with transaction.atomic(using=router.db_for_write(PreprodArtifact)):
        files_deleted = 0
        if all_file_ids:
            for file in File.objects.filter(id__in=all_file_ids):
                file.delete()
                files_deleted += 1

        _, deleted_by_model = PreprodArtifact.objects.filter(id__in=preprod_artifact_ids).delete()

    result = ArtifactDeletionResult(
        size_metrics_deleted=deleted_by_model.get("preprod.PreprodArtifactSizeMetrics", 0),
        installable_artifacts_deleted=deleted_by_model.get("preprod.InstallablePreprodArtifact", 0),
        artifacts_deleted=deleted_by_model.get("preprod.PreprodArtifact", 0),
        files_deleted=files_deleted,
    )

    logger.info("preprod.cleanup.bulk_delete_completed", extra=result.__dict__)

    return result


def _collect_snapshot_objectstore_keys(
    preprod_artifacts: list[PreprodArtifact],
) -> list[tuple[int, int, str]]:
    # Collects three types of objectstore keys for the given artifacts:
    # 1. Snapshot manifest keys (per-snapshot JSON manifests from PreprodSnapshotMetrics)
    # 2. Comparison manifest keys (diff manifests from PreprodSnapshotComparison)
    # 3. Diff mask image keys (per-image diff masks referenced within comparison manifests)
    # Note: shared content-addressed image keys are NOT collected — they expire via X-day TTL.
    artifact_ids = [a.id for a in preprod_artifacts]
    snapshot_metrics_list = list(
        PreprodSnapshotMetrics.objects.filter(preprod_artifact_id__in=artifact_ids).select_related(
            "preprod_artifact__project"
        )
    )
    if not snapshot_metrics_list:
        return []

    keys: list[tuple[int, int, str]] = []
    metrics_ids: list[int] = []

    for sm in snapshot_metrics_list:
        org_id = sm.preprod_artifact.project.organization_id
        project_id = sm.preprod_artifact.project_id
        metrics_ids.append(sm.id)

        manifest_key = (sm.extras or {}).get("manifest_key")
        if not manifest_key:
            continue

        # Image keys are content-addressed and shared across snapshots;
        # only delete the manifest, not images (they expire via X-day TTL).
        keys.append((org_id, project_id, manifest_key))

    for comp in PreprodSnapshotComparison.objects.filter(
        Q(head_snapshot_metrics_id__in=metrics_ids) | Q(base_snapshot_metrics_id__in=metrics_ids)
    ).select_related("head_snapshot_metrics__preprod_artifact__project"):
        org_id = comp.head_snapshot_metrics.preprod_artifact.project.organization_id
        project_id = comp.head_snapshot_metrics.preprod_artifact.project_id

        comparison_key = (comp.extras or {}).get("comparison_key")
        if not comparison_key:
            continue

        keys.append((org_id, project_id, comparison_key))
        try:
            session = get_preprod_session(org_id, project_id)
            comp_manifest = ComparisonManifest(
                **orjson.loads(session.get(comparison_key).payload.read())
            )
            for img in comp_manifest.images.values():
                if img.diff_mask_key:
                    keys.append((org_id, project_id, img.diff_mask_key))
        except Exception:
            logger.exception(
                "preprod.cleanup.comparison_manifest_read_failed",
                extra={"comparison_key": comparison_key},
            )

    return keys


def _delete_objectstore_key(args: tuple[int, int, str]) -> bool:
    org_id, project_id, key = args
    try:
        get_preprod_session(org_id, project_id).delete(key)
        return True
    except Exception:
        logger.exception("preprod.cleanup.objectstore_delete_failed", extra={"key": key})
        return False


def _delete_objectstore_keys(
    keys: list[tuple[int, int, str]],
) -> int:
    if not keys:
        return 0

    with ContextPropagatingThreadPoolExecutor(max_workers=8) as executor:
        deleted = sum(1 for ok in executor.map(_delete_objectstore_key, keys) if ok)

    logger.info(
        "preprod.cleanup.objectstore_delete_completed",
        extra={"keys_deleted": deleted, "keys_total": len(keys)},
    )
    return deleted


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

    try:
        objectstore_keys = list(
            dict.fromkeys(_collect_snapshot_objectstore_keys(preprod_artifacts))
        )
    except Exception:
        logger.exception("preprod.cleanup.snapshot_objectstore_key_collection_failed")
        objectstore_keys = []

    result = bulk_delete_artifacts(preprod_artifacts)

    try:
        result.objectstore_keys_deleted = _delete_objectstore_keys(objectstore_keys)
    except Exception:
        logger.exception("preprod.cleanup.snapshot_objectstore_delete_failed")

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

    Deletes by trace_id, which is a column-level filter allowed by Snuba's deletion settings.
    The trace_id is computed deterministically from the artifact ID using the same UUID5 logic
    as the write path in preprod/eap/write.py.
    """
    if not preprod_artifact_ids:
        return

    try:
        trace_ids = [get_preprod_trace_id(artifact_id) for artifact_id in preprod_artifact_ids]

        trace_id_filter = ComparisonFilter(
            key=AttributeKey(name="sentry.trace_id", type=AttributeKey.TYPE_STRING),
            op=ComparisonFilter.OP_IN,
            value=AttributeValue(val_str_array=StrArray(values=trace_ids)),
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
                    filter=TraceItemFilter(comparison_filter=trace_id_filter),
                )
            ],
        )
        snuba_rpc.delete_trace_items_rpc(request)
    except Exception:
        logger.exception("preprod_artifact.admin_batch_delete.eap_delete_failed")
