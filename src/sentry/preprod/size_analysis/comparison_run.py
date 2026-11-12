from __future__ import annotations

import logging
from collections.abc import Iterable, Sequence
from io import BytesIO

from django.db import router, transaction

from sentry.models.files.file import File
from sentry.preprod.models import PreprodArtifactSizeComparison, PreprodArtifactSizeMetrics
from sentry.preprod.size_analysis.compare import compare_size_analysis
from sentry.preprod.size_analysis.models import ComparisonResults, SizeAnalysisResults
from sentry.preprod.vcs.pr_comments.size_tasks import create_preprod_size_pr_comment_task
from sentry.preprod.vcs.status_checks.size.tasks import create_preprod_status_check_task
from sentry.utils.json import dumps_htmlsafe

logger = logging.getLogger(__name__)


def run_size_analysis_comparisons(
    org_id: int,
    comparisons: Sequence[dict[str, PreprodArtifactSizeMetrics]],
    follow_up_artifact_ids: Iterable[int],
) -> None:
    # Create PENDING comparison records in DB and run comparisons
    with transaction.atomic(router.db_for_write(PreprodArtifactSizeComparison)):
        for comp in comparisons:
            head_metric = comp["head_metric"]
            base_metric = comp["base_metric"]
            _, created = PreprodArtifactSizeComparison.objects.get_or_create(
                head_size_analysis=head_metric,
                base_size_analysis=base_metric,
                organization_id=org_id,
                defaults={"state": PreprodArtifactSizeComparison.State.PENDING},
            )

            logger.info(
                "preprod.size_analysis.compare.running_comparison",
                extra={
                    "head_metric_id": head_metric.id,
                    "base_metric_id": base_metric.id,
                    "comparison_created": created,
                },
            )
            run_size_analysis_comparison(org_id, head_metric, base_metric)

        _dispatch_follow_up_tasks(follow_up_artifact_ids)


def run_size_analysis_comparison(
    org_id: int,
    head_size_metric: PreprodArtifactSizeMetrics,
    base_size_metric: PreprodArtifactSizeMetrics,
) -> None:
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

    _mark_processing(comparison, head_size_metric, base_size_metric)

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

    _record_success(comparison, comparison_results)

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


def _mark_processing(
    comparison: PreprodArtifactSizeComparison,
    head_size_metric: PreprodArtifactSizeMetrics,
    base_size_metric: PreprodArtifactSizeMetrics,
) -> None:
    with transaction.atomic(router.db_for_write(PreprodArtifactSizeComparison)):
        logger.info(
            "preprod.size_analysis.compare.transitioning_pending_to_processing",
            extra={
                "head_artifact_size_metric_id": head_size_metric.id,
                "base_artifact_size_metric_id": base_size_metric.id,
            },
        )
        comparison.state = PreprodArtifactSizeComparison.State.PROCESSING
        comparison.save()


def _record_success(
    comparison: PreprodArtifactSizeComparison, comparison_results: ComparisonResults
) -> None:
    with transaction.atomic(router.db_for_write(PreprodArtifactSizeComparison)):
        file = File.objects.create(
            name=str(comparison.id),
            type="size_analysis_comparison.json",
            headers={"Content-Type": "application/json"},
        )
        results_json = dumps_htmlsafe(comparison_results.dict())
        results_bytes = results_json.encode()
        file.putfile(BytesIO(results_bytes))

        comparison.file_id = file.id
        comparison.state = PreprodArtifactSizeComparison.State.SUCCESS
        comparison.save()


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
