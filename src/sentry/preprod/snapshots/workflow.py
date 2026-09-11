from __future__ import annotations

import logging
from collections.abc import Callable, Iterator
from dataclasses import replace
from datetime import datetime
from typing import Any, NamedTuple
from uuid import uuid4

from django.contrib.postgres.fields import ArrayField
from django.db import IntegrityError, models, router, transaction
from django.db.models import F, Func, Value
from django.utils import timezone
from objectstore_client import RequestError

from sentry import options
from sentry.objectstore import UsecaseId, get_session
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.approval import (
    SiblingComparison,
    _build_comparison_fingerprints,
    _find_approved_sibling,
    _try_auto_approve_snapshot,
    plan_approval_diffs,
)
from sentry.preprod.snapshots.comparison import (
    _assemble_comparison,
    _create_pixel_batches,
    _failed_chunk,
    _process_chunk,
    _validate_chunk,
    plan_snapshot_changes,
)
from sentry.preprod.snapshots.constants import (
    CHUNK_RESULT_FETCH_WORKERS,
    MAX_PAIRS_PER_CHUNK,
    MAX_PIXELS_PER_BATCH,
    MISSING_BASE_GRACE_PERIOD_SECONDS,
    RECONSTRUCTION_RETRY_COUNTDOWN_SECONDS,
)
from sentry.preprod.snapshots.image_diff.compare import DIFF_ALGORITHM_VERSION
from sentry.preprod.snapshots.manifest import (
    ChunkAssignment,
    ChunkResult,
    ComparisonImageResult,
    ComparisonManifest,
    ComparisonPlan,
    SnapshotManifest,
)
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.snapshots.reconstruction import reconstruct_base_manifest
from sentry.preprod.snapshots.storage import ComparisonStorage, _get_json
from sentry.preprod.vcs.tasks import update_preprod_snapshot_vcs
from sentry.utils import metrics
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor

logger = logging.getLogger(__name__)
STORAGE_READ_ERRORS = (ValueError, FileNotFoundError, RequestError, TypeError)


class WorkflowTasks(NamedTuple):
    compare: Callable[..., Any]
    chunk: Callable[..., Any]
    finalize: Callable[..., Any]


class ComparisonInputs(NamedTuple):
    head: PreprodArtifact
    base: PreprodArtifact
    head_metrics: PreprodSnapshotMetrics
    base_metrics: PreprodSnapshotMetrics


def _run_queryset(
    comparison_id: int, execution_id: str | None
) -> models.QuerySet[PreprodSnapshotComparison]:
    queryset = PreprodSnapshotComparison.objects.filter(id=comparison_id)
    if execution_id is None:
        return queryset.filter(extras__snapshot_execution_id__isnull=True)
    return queryset.filter(extras__snapshot_execution_id=execution_id)


def _mark_chunk_done(comparison_id: int, chunk_index: int, execution_id: str | None = None) -> None:
    _run_queryset(comparison_id, execution_id).filter(
        state=PreprodSnapshotComparison.State.PROCESSING
    ).exclude(chunks_done_indices__contains=[chunk_index]).update(
        chunks_done_indices=Func(
            F("chunks_done_indices"),
            Value([chunk_index], output_field=ArrayField(models.IntegerField())),
            function="array_cat",
            output_field=ArrayField(models.IntegerField()),
        ),
        date_updated=timezone.now(),
    )


def _ready_to_finalize(comparison: PreprodSnapshotComparison) -> bool:
    if (
        comparison.state != PreprodSnapshotComparison.State.PROCESSING
        or comparison.chunks_total is None
    ):
        return False
    if (comparison.extras or {}).get("snapshot_execution_id"):
        return set(range(comparison.chunks_total)).issubset(comparison.chunks_done_indices)
    return len(comparison.chunks_done_indices) >= comparison.chunks_total


def _finalize_if_all_chunks_done(
    comparison_id: int, store: ComparisonStorage, tasks: WorkflowTasks
) -> None:
    comparison = _run_queryset(comparison_id, store.execution_id).first()
    if comparison is not None and _ready_to_finalize(comparison):
        tasks.finalize(kwargs={"comparison_id": comparison_id, **store.task_kwargs()})


def _fail_comparison(
    comparison_id: int,
    store: ComparisonStorage,
    error_code: PreprodSnapshotComparison.ErrorCode,
    message: str | None = None,
) -> None:
    failed = (
        _run_queryset(comparison_id, store.execution_id)
        .filter(state=PreprodSnapshotComparison.State.PROCESSING)
        .update(
            state=PreprodSnapshotComparison.State.FAILED,
            error_code=error_code,
            error_message=message,
            date_updated=timezone.now(),
        )
    )
    if failed:
        update_preprod_snapshot_vcs(
            preprod_artifact_id=store.head_artifact_id, caller="compare_failure"
        )


def _load_inputs(
    project_id: int, org_id: int, head_artifact_id: int, base_artifact_id: int
) -> ComparisonInputs | None:
    try:
        head = PreprodArtifact.objects.select_related(
            "project__organization", "commit_comparison"
        ).get(
            id=head_artifact_id,
            project_id=project_id,
            project__organization_id=org_id,
        )
        base = PreprodArtifact.objects.get(
            id=base_artifact_id,
            project_id=project_id,
            project__organization_id=org_id,
        )
        return ComparisonInputs(
            head,
            base,
            PreprodSnapshotMetrics.objects.get(preprod_artifact=head),
            PreprodSnapshotMetrics.objects.get(preprod_artifact=base),
        )
    except (PreprodArtifact.DoesNotExist, PreprodSnapshotMetrics.DoesNotExist):
        logger.exception(
            "Snapshot comparison artifact or metrics not found",
            extra={"head_artifact_id": head_artifact_id, "base_artifact_id": base_artifact_id},
        )
        update_preprod_snapshot_vcs(preprod_artifact_id=head_artifact_id, caller="compare_failure")
        return None


def _claim_comparison(
    inputs: ComparisonInputs,
) -> tuple[PreprodSnapshotComparison, int | None] | None:
    comparison: PreprodSnapshotComparison | None
    try:
        comparison, created = PreprodSnapshotComparison.objects.get_or_create(
            head_snapshot_metrics=inputs.head_metrics,
            base_snapshot_metrics=inputs.base_metrics,
            defaults={"state": PreprodSnapshotComparison.State.PROCESSING},
        )
    except IntegrityError:
        comparison = PreprodSnapshotComparison.objects.filter(
            head_snapshot_metrics=inputs.head_metrics,
            base_snapshot_metrics=inputs.base_metrics,
        ).first()
        if comparison is None:
            logger.exception(
                "Snapshot comparison not found after IntegrityError",
                extra={"head_artifact_id": inputs.head.id},
            )
            update_preprod_snapshot_vcs(
                preprod_artifact_id=inputs.head.id, caller="compare_failure"
            )
            return None
        created = False
    prior_state = None if created else comparison.state
    if created:
        return comparison, prior_state
    updated = PreprodSnapshotComparison.objects.filter(
        id=comparison.id,
        state__in=[PreprodSnapshotComparison.State.PENDING, PreprodSnapshotComparison.State.FAILED],
    ).update(state=PreprodSnapshotComparison.State.PROCESSING, date_updated=timezone.now())
    if not updated:
        updated = PreprodSnapshotComparison.objects.filter(
            id=comparison.id,
            state=PreprodSnapshotComparison.State.PROCESSING,
            chunks_total__isnull=True,
        ).update(date_updated=timezone.now())
    if not updated:
        return None
    comparison.refresh_from_db()
    return comparison, prior_state


def _load_manifests(
    inputs: ComparisonInputs, store: ComparisonStorage
) -> tuple[SnapshotManifest, SnapshotManifest]:
    head_key = (inputs.head_metrics.extras or {}).get("manifest_key")
    base_key = (inputs.base_metrics.extras or {}).get("manifest_key")
    if not head_key or not base_key:
        raise ValueError("Missing manifest key")
    return (
        _get_json(store.session, head_key, SnapshotManifest),
        _get_json(store.session, base_key, SnapshotManifest),
    )


def _complete_base(
    inputs: ComparisonInputs,
    comparison: PreprodSnapshotComparison,
    store: ComparisonStorage,
    base: SnapshotManifest,
    tasks: WorkflowTasks,
) -> SnapshotManifest | None:
    if not base.selective and base.all_image_file_names is None:
        return base
    result = reconstruct_base_manifest(inputs.base, store.session)
    if result.manifest is not None:
        return result.manifest
    if result.incomplete:
        age = (timezone.now() - comparison.date_added).total_seconds()
        if age <= MISSING_BASE_GRACE_PERIOD_SECONDS:
            PreprodSnapshotComparison.objects.filter(
                id=comparison.id,
                state=PreprodSnapshotComparison.State.PROCESSING,
            ).update(state=PreprodSnapshotComparison.State.PENDING, date_updated=timezone.now())
            tasks.compare(
                kwargs=store.task_kwargs(), countdown=RECONSTRUCTION_RETRY_COUNTDOWN_SECONDS
            )
        else:
            _fail_comparison(
                comparison.id,
                store,
                PreprodSnapshotComparison.ErrorCode.TIMEOUT,
                "Base snapshot chain incomplete (missing ancestor build).",
            )
        return None
    _fail_comparison(
        comparison.id,
        store,
        PreprodSnapshotComparison.ErrorCode.INTERNAL_ERROR,
        result.error_message or "No complete base snapshot exists in the ancestry chain.",
    )
    return None


def _build_comparison_plan(
    head_manifest: SnapshotManifest,
    base_manifest: SnapshotManifest,
    head_artifact_id: int,
    base_artifact_id: int,
    sibling: SiblingComparison | None = None,
    diff_sibling_images: bool = True,
    *,
    versioned: bool = False,
) -> ComparisonPlan:
    changes = plan_snapshot_changes(head_manifest, base_manifest)
    candidates = list(changes.candidates)
    if sibling is not None and diff_sibling_images:
        candidates.extend(plan_approval_diffs(head_manifest, changes, sibling))
    batches = _create_pixel_batches(
        candidates,
        MAX_PIXELS_PER_BATCH,
        MAX_PAIRS_PER_CHUNK if versioned else None,
    )
    return ComparisonPlan(
        head_artifact_id=head_artifact_id,
        base_artifact_id=base_artifact_id,
        non_diff_images=changes.images,
        chunks=[
            ChunkAssignment(
                chunk_index=index,
                candidates=batch,
                schema_version=2 if versioned else 1,
                diff_algorithm_version=DIFF_ALGORITHM_VERSION,
            )
            for index, batch in enumerate(batches)
        ],
        sibling_artifact_id=sibling.artifact_id if sibling else None,
        sibling_comparison_key=sibling.comparison_key if sibling else None,
        sibling_fingerprints=sorted(
            _build_comparison_fingerprints(sibling.manifest), key=lambda item: item.name
        )
        if versioned and sibling
        else None,
        schema_version=2 if versioned else 1,
        diff_algorithm_version=DIFF_ALGORITHM_VERSION,
    )


def _publish_plan(
    comparison: PreprodSnapshotComparison,
    store: ComparisonStorage,
    plan: ComparisonPlan,
) -> tuple[ComparisonStorage, ComparisonPlan] | None:
    if plan.schema_version == 1:
        store.write_plan(plan)
        return store, plan
    candidate_store = replace(store, execution_id=f"{comparison.id}-{uuid4().hex}")
    with ContextPropagatingThreadPoolExecutor(max_workers=CHUNK_RESULT_FETCH_WORKERS) as executor:
        for start in range(0, len(plan.chunks), CHUNK_RESULT_FETCH_WORKERS):
            list(
                executor.map(
                    candidate_store.write_assignment,
                    plan.chunks[start : start + CHUNK_RESULT_FETCH_WORKERS],
                )
            )
    candidate_store.write_plan(plan)
    with transaction.atomic(router.db_for_write(PreprodSnapshotComparison)):
        current = (
            PreprodSnapshotComparison.objects.select_for_update().filter(id=comparison.id).first()
        )
        if current is None or current.state != PreprodSnapshotComparison.State.PROCESSING:
            return None
        execution_id = (current.extras or {}).get("snapshot_execution_id")
        if execution_id is None:
            execution_id = candidate_store.execution_id
            current.extras = {**(current.extras or {}), "snapshot_execution_id": execution_id}
            current.save(update_fields=["extras", "date_updated"])
    comparison.extras = current.extras
    if execution_id == candidate_store.execution_id:
        return candidate_store, plan
    winning_store = replace(store, execution_id=execution_id)
    return winning_store, winning_store.read_plan()


def _prepare_plan(
    inputs: ComparisonInputs,
    comparison: PreprodSnapshotComparison,
    store: ComparisonStorage,
    tasks: WorkflowTasks,
) -> tuple[ComparisonStorage, ComparisonPlan] | None:
    if store.execution_id is not None:
        return store, store.read_plan()
    head, base = _load_manifests(inputs, store)
    complete_base = _complete_base(inputs, comparison, store, base, tasks)
    if complete_base is None:
        return None
    versioned = (
        options.get("preprod.snapshots.versioned-comparison-plans.enabled")
        and comparison.chunks_total is None
        and not comparison.chunks_done_indices
    )
    sibling = _find_approved_sibling(inputs.head, store.session)
    plan = _build_comparison_plan(
        head,
        complete_base,
        inputs.head.id,
        inputs.base.id,
        sibling,
        options.get("preprod.snapshots.auto-approve-sibling-diffs.enabled"),
        versioned=versioned,
    )
    return _publish_plan(comparison, store, plan)


def _dispatch_plan(
    comparison: PreprodSnapshotComparison,
    store: ComparisonStorage,
    plan: ComparisonPlan,
    tasks: WorkflowTasks,
    started_at: datetime,
) -> None:
    completed = set(comparison.chunks_done_indices) if store.execution_id else set()
    for assignment in plan.chunks:
        if assignment.chunk_index in completed:
            continue
        tasks.chunk(
            kwargs={
                "comparison_id": comparison.id,
                "chunk_index": assignment.chunk_index,
                **store.task_kwargs(),
            }
        )
    extras = {**(comparison.extras or {})}
    extras.setdefault("diff_processing_started_at", started_at.isoformat())
    updated = (
        _run_queryset(comparison.id, store.execution_id)
        .filter(
            state=PreprodSnapshotComparison.State.PROCESSING,
        )
        .update(chunks_total=len(plan.chunks), extras=extras, date_updated=timezone.now())
    )
    if updated:
        logger.info(
            "compare_snapshots: orchestration dispatched",
            extra={**store.task_kwargs(), "chunks_total": len(plan.chunks)},
        )
        _finalize_if_all_chunks_done(comparison.id, store, tasks)


def compare_snapshots(
    project_id: int,
    org_id: int,
    head_artifact_id: int,
    base_artifact_id: int,
    tasks: WorkflowTasks,
) -> None:
    started_at = timezone.now()
    inputs = _load_inputs(project_id, org_id, head_artifact_id, base_artifact_id)
    if inputs is None:
        return
    claimed = _claim_comparison(inputs)
    if claimed is None:
        return
    comparison, prior_state = claimed
    store = ComparisonStorage(
        get_session(UsecaseId.PREPROD, project_id, org=org_id),
        org_id,
        project_id,
        head_artifact_id,
        base_artifact_id,
    )
    store = replace(store, execution_id=(comparison.extras or {}).get("snapshot_execution_id"))
    if prior_state != PreprodSnapshotComparison.State.PENDING:
        update_preprod_snapshot_vcs(
            preprod_artifact_id=head_artifact_id, caller="compare_start", update_pr_comment=False
        )
    try:
        try:
            prepared = _prepare_plan(inputs, comparison, store, tasks)
        except STORAGE_READ_ERRORS:
            store = replace(
                store, execution_id=(comparison.extras or {}).get("snapshot_execution_id")
            )
            logger.exception(
                "compare_snapshots: failed to load or parse manifest", extra=store.task_kwargs()
            )
            _fail_comparison(
                comparison.id,
                store,
                PreprodSnapshotComparison.ErrorCode.INTERNAL_ERROR,
                "Failed to load or parse snapshot manifest.",
            )
            return
        if prepared is None:
            return
        store, plan = prepared
        _dispatch_plan(comparison, store, plan, tasks, started_at)
    except BaseException:
        logger.exception(
            "Snapshot comparison failed",
            extra={
                **store.task_kwargs(),
                "organization_slug": inputs.head.project.organization.slug,
            },
        )
        try:
            _fail_comparison(
                comparison.id, store, PreprodSnapshotComparison.ErrorCode.INTERNAL_ERROR
            )
        except Exception:
            logger.exception(
                "Failed to save FAILED state for comparison", extra={"comparison_id": comparison.id}
            )
        raise


def process_snapshot_comparison_chunk(
    comparison_id: int,
    chunk_index: int,
    org_id: int,
    project_id: int,
    head_artifact_id: int,
    base_artifact_id: int,
    tasks: WorkflowTasks,
    execution_id: str | None = None,
) -> None:
    if (
        execution_id is not None
        and not _run_queryset(comparison_id, execution_id)
        .filter(
            state=PreprodSnapshotComparison.State.PROCESSING,
        )
        .exists()
    ):
        return
    store = ComparisonStorage(
        get_session(UsecaseId.PREPROD, project_id, org=org_id),
        org_id,
        project_id,
        head_artifact_id,
        base_artifact_id,
        execution_id,
    )
    try:
        assignment = store.read_assignment(chunk_index)
        if assignment is not None:
            if (
                execution_id is not None
                and assignment.diff_algorithm_version != DIFF_ALGORITHM_VERSION
            ):
                raise ValueError("Unsupported image comparison algorithm version")
            mask_options = (
                {"mask_prefix": f"{store.prefix}/diff/{uuid4().hex}"} if execution_id else {}
            )
            result = _process_chunk(
                store.session,
                assignment,
                org_id,
                project_id,
                head_artifact_id,
                base_artifact_id,
                **mask_options,
            )
            store.write_chunk_result(result)
    except Exception as error:
        logger.exception(
            "compare_snapshots: chunk failed",
            extra={
                "comparison_id": comparison_id,
                "chunk_index": chunk_index,
                "error_type": type(error).__name__,
                "error": str(error),
            },
        )
    _mark_chunk_done(comparison_id, chunk_index, execution_id)
    _finalize_if_all_chunks_done(comparison_id, store, tasks)


def _read_chunk_results(
    comparison: PreprodSnapshotComparison,
    store: ComparisonStorage,
    plan: ComparisonPlan,
) -> Iterator[ChunkResult]:
    completed = set(comparison.chunks_done_indices)

    def read(assignment: ChunkAssignment) -> ChunkResult:
        if assignment.chunk_index not in completed:
            return _failed_chunk(assignment, "chunk_failed")
        try:
            result = store.read_chunk_result(assignment.chunk_index)
            if store.execution_id is not None:
                _validate_chunk(assignment, result)
            return result
        except STORAGE_READ_ERRORS:
            logger.exception(
                "finalize: failed to read done chunk result, degrading to errored",
                extra={"comparison_id": comparison.id, "chunk_index": assignment.chunk_index},
            )
            return _failed_chunk(assignment, "chunk_result_unreadable")

    with ContextPropagatingThreadPoolExecutor(max_workers=CHUNK_RESULT_FETCH_WORKERS) as executor:
        for start in range(0, len(plan.chunks), CHUNK_RESULT_FETCH_WORKERS):
            yield from executor.map(read, plan.chunks[start : start + CHUNK_RESULT_FETCH_WORKERS])


def finalize_snapshot_comparison(
    comparison_id: int,
    org_id: int,
    project_id: int,
    head_artifact_id: int,
    base_artifact_id: int,
    tasks: WorkflowTasks,
    execution_id: str | None = None,
) -> None:
    comparison = _run_queryset(comparison_id, execution_id).first()
    if comparison is None or not _ready_to_finalize(comparison):
        return
    _run_queryset(comparison_id, execution_id).filter(
        state=PreprodSnapshotComparison.State.PROCESSING
    ).update(date_updated=timezone.now())
    store = ComparisonStorage(
        get_session(UsecaseId.PREPROD, project_id, org=org_id),
        org_id,
        project_id,
        head_artifact_id,
        base_artifact_id,
        execution_id,
    )
    try:
        plan = store.read_plan()
        if execution_id is not None and plan.diff_algorithm_version != DIFF_ALGORITHM_VERSION:
            raise ValueError("Unsupported image comparison algorithm version")
        if execution_id is not None and len(plan.chunks) != comparison.chunks_total:
            raise ValueError("Comparison plan does not match the dispatched chunk count")
    except STORAGE_READ_ERRORS:
        logger.exception(
            "finalize: failed to read comparison plan, failing comparison",
            extra={"comparison_id": comparison_id},
        )
        _fail_comparison(comparison_id, store, PreprodSnapshotComparison.ErrorCode.INTERNAL_ERROR)
        return
    manifest, sibling_images = _assemble_comparison(
        plan, _read_chunk_results(comparison, store, plan)
    )
    comparison_key = store.write_comparison(manifest)
    counts = manifest.summary.dict(exclude={"total"})
    updated = (
        _run_queryset(comparison_id, execution_id)
        .filter(
            state=PreprodSnapshotComparison.State.PROCESSING,
        )
        .update(
            state=PreprodSnapshotComparison.State.SUCCESS,
            error_code=None,
            **{f"images_{status}": count for status, count in counts.items()},
            extras={
                **(comparison.extras or {}),
                "comparison_key": comparison_key,
                "diff_algorithm_version": plan.diff_algorithm_version
                if execution_id
                else DIFF_ALGORITHM_VERSION,
            },
            date_updated=timezone.now(),
        )
    )
    if updated:
        _completion_effects(comparison, store, manifest, sibling_images, plan)


def _completion_effects(
    comparison: PreprodSnapshotComparison,
    store: ComparisonStorage,
    comparison_manifest: ComparisonManifest,
    sibling_images: dict[str, ComparisonImageResult],
    plan: ComparisonPlan,
) -> None:
    head_artifact_id = store.head_artifact_id
    org_id, project_id = store.org_id, store.project_id
    session = store.session
    counts = comparison_manifest.summary.dict(exclude={"total"})
    try:
        head_artifact = PreprodArtifact.objects.select_related("project__organization").get(
            id=head_artifact_id,
            project__organization_id=org_id,
            project_id=project_id,
        )
    except PreprodArtifact.DoesNotExist:
        logger.warning(
            "compare_snapshots: head artifact deleted before finalize side effects",
            extra={"comparison_id": comparison.id, "head_artifact_id": head_artifact_id},
        )
        return

    logger.info(
        "compare_snapshots: finalized",
        extra={
            "comparison_id": comparison.id,
            "organization_id": org_id,
            "organization_slug": head_artifact.project.organization.slug,
            "project_id": project_id,
            "done": len(comparison.chunks_done_indices),
            "chunks_total": comparison.chunks_total,
            "images_changed": counts["changed"],
            "images_added": counts["added"],
            "images_removed": counts["removed"],
            "images_unchanged": counts["unchanged"],
            "images_renamed": counts["renamed"],
            "images_skipped": counts["skipped"],
            "images_errored": counts["errored"],
        },
    )

    metric_tags = {
        "app_id_temp": head_artifact.app_id or "",
    }

    e2e_duration_s = (timezone.now() - head_artifact.date_added).total_seconds()
    metrics.distribution(
        "preprod.snapshots.e2e_duration_s",
        e2e_duration_s,
        sample_rate=1.0,
        tags=metric_tags,
    )

    started_raw = (comparison.extras or {}).get("diff_processing_started_at")
    if started_raw:
        try:
            diff_duration_s = (timezone.now() - datetime.fromisoformat(started_raw)).total_seconds()
        except (ValueError, TypeError):
            logger.warning(
                "finalize: unparseable diff_processing_started_at, skipping metric",
                extra={"comparison_id": comparison.id},
            )
        else:
            metrics.distribution(
                "preprod.snapshots.diff.duration_s",
                diff_duration_s,
                sample_rate=1.0,
                tags=metric_tags,
            )

    if (
        counts["changed"] == 0
        and counts["added"] == 0
        and counts["removed"] == 0
        and counts["renamed"] == 0
        and counts["errored"] == 0
    ):
        metrics.incr("preprod.snapshots.diff.zero_changes", sample_rate=1.0, tags=metric_tags)

    try:
        _try_auto_approve_snapshot(
            head_artifact, comparison_manifest, plan, sibling_images, session
        )
    except Exception:
        logger.exception(
            "Auto-approve failed after successful comparison",
            extra={"head_artifact_id": head_artifact_id},
        )

    # Best-effort: the row is already SUCCESS, so a raise here would only no-op on retry.
    try:
        update_preprod_snapshot_vcs(
            preprod_artifact_id=head_artifact_id, caller="compare_completion"
        )
    except Exception:
        logger.exception(
            "compare_completion VCS update failed after successful comparison",
            extra={"head_artifact_id": head_artifact_id, "comparison_id": comparison.id},
        )
