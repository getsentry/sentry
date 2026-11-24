from __future__ import annotations

import logging
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from io import BytesIO

from django.db import router, transaction
from django.utils import timezone

from sentry.models.files.file import File
from sentry.preprod.models import PreprodArtifactSizeComparison, PreprodArtifactSizeMetrics
from sentry.preprod.size_analysis.compare import compare_size_analysis
from sentry.preprod.size_analysis.models import ComparisonResults, SizeAnalysisResults
from sentry.preprod.vcs.pr_comments.size_tasks import create_preprod_size_pr_comment_task
from sentry.preprod.vcs.status_checks.size.tasks import create_preprod_status_check_task
from sentry.utils.json import dumps_htmlsafe

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class _PreparedSizeComparison:
    """A comparison computed ahead of its row; result_file is None for a missing analysis file."""

    head_metric: PreprodArtifactSizeMetrics
    base_metric: PreprodArtifactSizeMetrics
    result_file: File | None


def run_size_analysis_comparisons(
    org_id: int,
    comparisons: Sequence[dict[str, PreprodArtifactSizeMetrics]],
    follow_up_artifact_ids: Iterable[int],
) -> None:
    """One task invocation's comparisons, recorded together last so a failure leaves no rows."""
    result_files: list[File] = []
    try:
        prepared_comparisons: list[_PreparedSizeComparison] = []
        for comp in comparisons:
            prepared = _prepare_size_analysis_comparison(
                org_id, comp["head_metric"], comp["base_metric"]
            )
            if prepared is None:
                continue
            prepared_comparisons.append(prepared)
            if prepared.result_file is not None:
                result_files.append(prepared.result_file)

        # One lock order for every run, so two overlapping runs cannot deadlock
        ordered_comparisons = sorted(
            prepared_comparisons,
            key=lambda prepared: (prepared.head_metric.id, prepared.base_metric.id),
        )
        with transaction.atomic(router.db_for_write(PreprodArtifactSizeComparison)):
            pending_comparisons = [
                PreprodArtifactSizeComparison(
                    head_size_analysis=prepared.head_metric,
                    base_size_analysis=prepared.base_metric,
                    organization_id=org_id,
                    state=PreprodArtifactSizeComparison.State.PENDING,
                )
                for prepared in ordered_comparisons
            ]
            # ignore_conflicts, not get_or_create: no savepoint inside the transaction
            PreprodArtifactSizeComparison.objects.bulk_create(
                pending_comparisons, ignore_conflicts=True
            )
            for prepared in ordered_comparisons:
                _record_size_analysis_comparison(org_id, prepared)
            # Dispatched before the commit, as before, so a deadline at COMMIT cannot lose them
            _dispatch_follow_up_tasks(follow_up_artifact_ids)
    finally:
        # Runs on the processing deadline too; a file stays only if a committed row points at it
        _delete_unreferenced_result_files(result_files)


def run_size_analysis_comparison(
    org_id: int,
    head_size_metric: PreprodArtifactSizeMetrics,
    base_size_metric: PreprodArtifactSizeMetrics,
) -> None:
    """One comparison on an existing PENDING row; PROCESSING lets the sweeper fail a stuck one."""
    comparison = _get_pending_comparison(org_id, head_size_metric, base_size_metric)
    if comparison is None:
        return

    analysis_files = _get_analysis_files(head_size_metric, base_size_metric)
    if analysis_files is None:
        _mark_failed(comparison)
        return
    head_analysis_file, base_analysis_file = analysis_files

    head_size_analysis_results = _load_size_analysis_results(head_analysis_file)
    base_size_analysis_results = _load_size_analysis_results(base_analysis_file)

    logger.info(
        "preprod.size_analysis.compare.running_comparison",
        extra={
            "head_artifact_size_metric_id": head_size_metric.id,
            "base_artifact_size_metric_id": base_size_metric.id,
        },
    )

    claimed = _claim_comparison(comparison, head_size_metric, base_size_metric)
    if not claimed:
        return

    comparison_results = compare_size_analysis(
        head_size_analysis=head_size_metric,
        head_size_analysis_results=head_size_analysis_results,
        base_size_analysis=base_size_metric,
        base_size_analysis_results=base_size_analysis_results,
    )

    logger.info(
        "preprod.size_analysis.compare.create_file",
        extra={"comparison_id": comparison.id},
    )

    file_name = str(comparison.id)
    result_file = _store_size_comparison_results(file_name, comparison_results)
    _record_success(comparison, result_file)

    logger.info(
        "preprod.size_analysis.compare.success",
        extra={"comparison_id": comparison.id},
    )


def _prepare_size_analysis_comparison(
    org_id: int,
    head_size_metric: PreprodArtifactSizeMetrics,
    base_size_metric: PreprodArtifactSizeMetrics,
) -> _PreparedSizeComparison | None:
    existing_comparisons = PreprodArtifactSizeComparison.objects.filter(
        head_size_analysis=head_size_metric,
        base_size_analysis=base_size_metric,
        organization_id=org_id,
    )
    existing_comparison = existing_comparisons.first()
    if (
        existing_comparison is not None
        and existing_comparison.state != PreprodArtifactSizeComparison.State.PENDING
    ):
        logger.info(
            "preprod.size_analysis.compare.existing_comparison",
            extra={
                "head_artifact_size_metric_id": head_size_metric.id,
                "base_artifact_size_metric_id": base_size_metric.id,
                "state": existing_comparison.state,
            },
        )
        return None

    analysis_files = _get_analysis_files(head_size_metric, base_size_metric)
    if analysis_files is None:
        return _PreparedSizeComparison(
            head_metric=head_size_metric, base_metric=base_size_metric, result_file=None
        )
    head_analysis_file, base_analysis_file = analysis_files

    head_size_analysis_results = _load_size_analysis_results(head_analysis_file)
    base_size_analysis_results = _load_size_analysis_results(base_analysis_file)

    logger.info(
        "preprod.size_analysis.compare.running_comparison",
        extra={
            "head_artifact_size_metric_id": head_size_metric.id,
            "base_artifact_size_metric_id": base_size_metric.id,
        },
    )

    comparison_results = compare_size_analysis(
        head_size_analysis=head_size_metric,
        head_size_analysis_results=head_size_analysis_results,
        base_size_analysis=base_size_metric,
        base_size_analysis_results=base_size_analysis_results,
    )

    logger.info(
        "preprod.size_analysis.compare.create_file",
        extra={
            "head_artifact_size_metric_id": head_size_metric.id,
            "base_artifact_size_metric_id": base_size_metric.id,
        },
    )

    provisional_file_name = f"{head_size_metric.id}-{base_size_metric.id}"
    result_file = _store_size_comparison_results(provisional_file_name, comparison_results)
    return _PreparedSizeComparison(
        head_metric=head_size_metric, base_metric=base_size_metric, result_file=result_file
    )


def _record_size_analysis_comparison(org_id: int, prepared: _PreparedSizeComparison) -> None:
    locked_comparisons = PreprodArtifactSizeComparison.objects.select_for_update().filter(
        head_size_analysis=prepared.head_metric,
        base_size_analysis=prepared.base_metric,
        organization_id=org_id,
    )
    comparison = locked_comparisons.first()

    # Checked again under the lock: another run may have recorded or deleted this pair meanwhile
    if comparison is None:
        return

    if comparison.state != PreprodArtifactSizeComparison.State.PENDING:
        logger.info(
            "preprod.size_analysis.compare.recorded_by_another_run",
            extra={
                "head_artifact_size_metric_id": prepared.head_metric.id,
                "base_artifact_size_metric_id": prepared.base_metric.id,
                "state": comparison.state,
            },
        )
        return

    if prepared.result_file is None:
        comparison.state = PreprodArtifactSizeComparison.State.FAILED
        comparison.save()
        return

    # The file was stored before its row existed, so it takes the row id as its name here
    prepared.result_file.name = str(comparison.id)
    prepared.result_file.save(update_fields=["name"])

    comparison.file_id = prepared.result_file.id
    comparison.state = PreprodArtifactSizeComparison.State.SUCCESS
    comparison.save()

    logger.info(
        "preprod.size_analysis.compare.success",
        extra={"comparison_id": comparison.id},
    )


def _dispatch_follow_up_tasks(artifact_ids: Iterable[int]) -> None:
    for artifact_id in artifact_ids:
        # Update all artifact's status check with the new comparison
        create_preprod_status_check_task.apply_async(
            kwargs={
                "preprod_artifact_id": artifact_id,
                "caller": "compare_completion",
            }
        )
        create_preprod_size_pr_comment_task.apply_async(
            kwargs={
                "preprod_artifact_id": artifact_id,
                "caller": "compare_completion",
            }
        )


def _get_pending_comparison(
    org_id: int,
    head_size_metric: PreprodArtifactSizeMetrics,
    base_size_metric: PreprodArtifactSizeMetrics,
) -> PreprodArtifactSizeComparison | None:
    try:
        comparison = PreprodArtifactSizeComparison.objects.get(
            head_size_analysis=head_size_metric,
            base_size_analysis=base_size_metric,
            organization_id=org_id,
        )
    except PreprodArtifactSizeComparison.DoesNotExist:
        logger.info(
            "preprod.size_analysis.compare.no_existing_comparison",
            extra={
                "head_artifact_size_metric_id": head_size_metric.id,
                "base_artifact_size_metric_id": base_size_metric.id,
            },
        )
        with transaction.atomic(router.db_for_write(PreprodArtifactSizeComparison)):
            failed_comparison = PreprodArtifactSizeComparison.objects.create(
                head_size_analysis=head_size_metric,
                base_size_analysis=base_size_metric,
                organization_id=org_id,
                state=PreprodArtifactSizeComparison.State.FAILED,
            )
            failed_comparison.save()
        return None

    # Skip if comparison is already complete or currently running
    if comparison.state in [
        PreprodArtifactSizeComparison.State.PROCESSING,
        PreprodArtifactSizeComparison.State.SUCCESS,
        PreprodArtifactSizeComparison.State.FAILED,
    ]:
        logger.info(
            "preprod.size_analysis.compare.existing_comparison",
            extra={
                "head_artifact_size_metric_id": head_size_metric.id,
                "base_artifact_size_metric_id": base_size_metric.id,
                "state": comparison.state,
            },
        )
        return None

    return comparison


def _mark_failed(comparison: PreprodArtifactSizeComparison) -> None:
    with transaction.atomic(router.db_for_write(PreprodArtifactSizeComparison)):
        comparison.state = PreprodArtifactSizeComparison.State.FAILED
        comparison.save()


def _claim_comparison(
    comparison: PreprodArtifactSizeComparison,
    head_size_metric: PreprodArtifactSizeMetrics,
    base_size_metric: PreprodArtifactSizeMetrics,
) -> bool:
    # Claimed only while still PENDING: another run may have recorded it meanwhile
    pending_comparison = PreprodArtifactSizeComparison.objects.filter(
        id=comparison.id, state=PreprodArtifactSizeComparison.State.PENDING
    )
    claimed = pending_comparison.update(
        state=PreprodArtifactSizeComparison.State.PROCESSING, date_updated=timezone.now()
    )
    if not claimed:
        return False

    logger.info(
        "preprod.size_analysis.compare.transitioning_pending_to_processing",
        extra={
            "head_artifact_size_metric_id": head_size_metric.id,
            "base_artifact_size_metric_id": base_size_metric.id,
        },
    )
    comparison.state = PreprodArtifactSizeComparison.State.PROCESSING
    return True


def _record_success(comparison: PreprodArtifactSizeComparison, result_file: File) -> None:
    try:
        with transaction.atomic(router.db_for_write(PreprodArtifactSizeComparison)):
            comparison.file_id = result_file.id
            comparison.state = PreprodArtifactSizeComparison.State.SUCCESS
            comparison.save()
    except BaseException:
        _delete_unreferenced_result_files([result_file])
        raise


def _store_size_comparison_results(name: str, comparison_results: ComparisonResults) -> File:
    file = File.objects.create(
        name=name,
        type="size_analysis_comparison.json",
        headers={"Content-Type": "application/json"},
    )
    try:
        results_json = dumps_htmlsafe(comparison_results.dict())
        results_bytes = results_json.encode()
        file.putfile(BytesIO(results_bytes))
    except BaseException:
        _delete_unreferenced_result_files([file])
        raise
    return file


def _delete_unreferenced_result_files(files: Sequence[File]) -> None:
    for file in files:
        try:
            referencing_comparisons = PreprodArtifactSizeComparison.objects.filter(file_id=file.id)
            if not referencing_comparisons.exists():
                file.delete()
        except Exception:
            logger.exception(
                "preprod.size_analysis.compare.result_file_cleanup_failed",
                extra={"file_id": file.id},
            )


def _get_analysis_files(
    head_size_metric: PreprodArtifactSizeMetrics, base_size_metric: PreprodArtifactSizeMetrics
) -> tuple[File, File] | None:
    try:
        head_analysis_file = File.objects.get(id=head_size_metric.analysis_file_id)
    except File.DoesNotExist:
        logger.exception(
            "preprod.size_analysis.compare.head_analysis_file_not_found",
            extra={
                "head_artifact_size_metric_id": head_size_metric.id,
                "head_artifact_id": head_size_metric.preprod_artifact.id,
            },
        )
        return None

    try:
        base_analysis_file = File.objects.get(id=base_size_metric.analysis_file_id)
    except File.DoesNotExist:
        logger.exception(
            "preprod.size_analysis.compare.base_analysis_file_not_found",
            extra={
                "base_artifact_size_metric_id": base_size_metric.id,
                "base_artifact_id": base_size_metric.preprod_artifact.id,
            },
        )
        return None

    return head_analysis_file, base_analysis_file


def _load_size_analysis_results(analysis_file: File) -> SizeAnalysisResults:
    analysis_fileobj = analysis_file.getfile()
    analysis_content = analysis_fileobj.read()
    return SizeAnalysisResults.parse_raw(analysis_content)
