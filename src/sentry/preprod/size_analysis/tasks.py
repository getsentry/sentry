import logging
from io import BytesIO

from sentry.models.commitcomparison import CommitComparison
from sentry.models.files.file import File
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.preprod.size_analysis.compare import compare_size_analysis
from sentry.preprod.size_analysis.models import SizeAnalysisResults
from sentry.preprod.size_analysis.utils import build_size_metrics_map, can_compare_size_metrics
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import attachments_tasks
from sentry.utils.json import dumps_htmlsafe

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.preprod.tasks.compare_preprod_artifact_size_analysis",
    # TODO: Consider using a dedicated compare queue
    queue="default",
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=attachments_tasks,
        processing_deadline_duration=30,
    ),
)
def compare_preprod_artifact_size_analysis(
    artifact_id: int,
):
    try:
        artifact = PreprodArtifact.objects.get(
            id=artifact_id,
        )
    except PreprodArtifact.DoesNotExist:
        logger.exception(
            "preprod.size_analysis.compare.artifact_not_found",
            extra={
                "artifact_id": artifact_id,
            },
        )
        return

    if not artifact.commit_comparison:
        logger.info(
            "preprod.size_analysis.compare.artifact_no_commit_comparison",
            extra={"artifact_id": artifact_id},
        )
        return

    # Run all comparisons with artifact as head
    base_commit_comparisons = CommitComparison.objects.filter(
        head_sha=artifact.commit_comparison.base_sha,
    )
    for base_commit_comparison in base_commit_comparisons:
        try:
            base_artifact = PreprodArtifact.objects.get(
                project=artifact.project,
                app_id=artifact.app_id,
                commit_comparison=base_commit_comparison,
            )
        except PreprodArtifact.DoesNotExist:
            logger.exception(
                "preprod.size_analysis.compare.base_artifact_not_found",
                extra={"commit_comparison_id": base_commit_comparison.id},
            )
            continue

        base_size_metrics = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact_id__in=[base_artifact.id],
        ).select_related("preprod_artifact")
        head_size_metrics = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact_id__in=[artifact_id],
        ).select_related("preprod_artifact")

        if not can_compare_size_metrics(head_size_metrics, base_size_metrics):
            logger.info(
                "preprod.size_analysis.compare.cannot_compare_size_metrics",
                extra={"head_artifact_id": artifact_id, "base_artifact_id": base_artifact.id},
            )
            continue

        base_metrics_map = build_size_metrics_map(base_artifact.size_metrics.all())
        head_metrics_map = build_size_metrics_map(artifact.size_metrics.all())

        for key, base_metric in base_metrics_map.items():
            matching_head_size_metric = head_metrics_map.get(key)
            if matching_head_size_metric:
                logger.info(
                    "preprod.size_analysis.compare.running_comparison",
                    extra={
                        "head_artifact_id": artifact_id,
                        "base_artifact_id": base_artifact.id,
                        "size_metric_id": (
                            matching_head_size_metric.id
                            if matching_head_size_metric.identifier
                            else None
                        ),
                    },
                )
                _run_size_analysis_comparison(matching_head_size_metric, base_metric)
            else:
                logger.info(
                    "preprod.size_analysis.compare.no_matching_base_size_metric",
                    extra={"head_artifact_id": artifact_id, "size_metric_id": base_metric.id},
                )

    # Also run comparisons with artifact as base
    head_commit_comparisons = CommitComparison.objects.filter(
        base_sha=artifact.commit_comparison.head_sha,
    )
    for head_commit_comparison in head_commit_comparisons:
        try:
            head_artifact = PreprodArtifact.objects.get(
                project=artifact.project,
                app_id=artifact.app_id,
                commit_comparison=head_commit_comparison,
            )
        except PreprodArtifact.DoesNotExist:
            logger.exception(
                "preprod.size_analysis.compare.head_artifact_not_found",
                extra={"commit_comparison_id": head_commit_comparison.id},
            )
            continue

        head_size_metrics = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact_id__in=[head_artifact.id],
        ).select_related("preprod_artifact")
        base_size_metrics = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact_id__in=[artifact_id],
        ).select_related("preprod_artifact")

        if not can_compare_size_metrics(head_size_metrics, base_size_metrics):
            logger.info(
                "preprod.size_analysis.compare.cannot_compare_size_metrics",
                extra={"head_artifact_id": head_artifact.id, "base_artifact_id": artifact_id},
            )
            continue

        head_metrics_map = build_size_metrics_map(head_size_metrics)
        base_metrics_map = build_size_metrics_map(base_size_metrics)

        for key, head_metric in head_metrics_map.items():
            matching_base_size_metric = base_metrics_map.get(key)
            if matching_base_size_metric:
                logger.info(
                    "preprod.size_analysis.compare.running_comparison",
                    extra={"base_artifact_id": artifact_id, "head_artifact_id": head_artifact.id},
                )
                _run_size_analysis_comparison(head_metric, matching_base_size_metric)
            else:
                logger.info(
                    "preprod.size_analysis.compare.no_matching_base_size_metric",
                    extra={"head_artifact_id": head_artifact.id, "size_metric_id": head_metric.id},
                )


@instrumented_task(
    name="sentry.preprod.tasks.manual_size_analysis_comparison",
    # TODO: Consider using a dedicated compare queue
    queue="default",
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=attachments_tasks,
        processing_deadline_duration=30,
    ),
)
def manual_size_analysis_comparison(
    head_size_metric_id: int,
    base_size_metric_id: int,
):
    try:
        head_size_metric = PreprodArtifactSizeMetrics.objects.get(id=head_size_metric_id)
    except PreprodArtifact.DoesNotExist:
        logger.exception(
            "preprod.size_analysis.compare.head_artifact_not_found",
            extra={"head_size_metric_id": head_size_metric_id},
        )
        return

    try:
        base_size_metric = PreprodArtifactSizeMetrics.objects.get(id=base_size_metric_id)
    except PreprodArtifact.DoesNotExist:
        logger.exception(
            "preprod.size_analysis.compare.base_artifact_not_found",
            extra={"base_size_metric_id": base_size_metric_id},
        )
        return

    _run_size_analysis_comparison(head_size_metric, base_size_metric)


def _run_size_analysis_comparison(
    base_size_metric: PreprodArtifactSizeMetrics,
    head_size_metric: PreprodArtifactSizeMetrics,
):
    try:
        comparison = PreprodArtifactSizeComparison.objects.get(
            head_size_analysis=base_size_metric,
            base_size_analysis=head_size_metric,
        )

        # Existing comparison exists or is already running,
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
                },
            )
            return

    except PreprodArtifactSizeComparison.DoesNotExist:
        logger.info(
            "preprod.size_analysis.compare.no_existing_comparison",
            extra={
                "head_artifact_size_metric_id": head_size_metric.id,
                "base_artifact_size_metric_id": base_size_metric.id,
            },
        )
        pass

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
        return

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
        return

    head_size_analysis_results = SizeAnalysisResults.parse_raw(head_analysis_file.getfile().read())
    base_size_analysis_results = SizeAnalysisResults.parse_raw(base_analysis_file.getfile().read())

    logger.info(
        "preprod.size_analysis.compare.start",
        extra={
            "head_artifact_size_metric_id": head_size_metric.id,
            "base_artifact_size_metric_id": base_size_metric.id,
        },
    )

    comparison = PreprodArtifactSizeComparison.objects.create(
        head_size_analysis=head_size_metric,
        base_size_analysis=base_size_metric,
        organization_id=head_size_metric.preprod_artifact.project.organization.id,
        state=PreprodArtifactSizeComparison.State.PROCESSING,
    )

    comparison_results = compare_size_analysis(
        head_size_metric,
        head_size_analysis_results,
        base_size_metric,
        base_size_analysis_results,
    )

    logger.info(
        "preprod.size_analysis.compare.create_file",
        extra={"comparison_id": comparison.id},
    )
    file = File.objects.create(
        name=comparison.id,
        type="size_analysis_comparison.json",
        headers={"Content-Type": "application/json"},
    )
    file.putfile(BytesIO(dumps_htmlsafe(comparison_results.dict()).encode()))

    comparison.file_id = file.id
    comparison.state = PreprodArtifactSizeComparison.State.SUCCESS
    comparison.save()

    logger.info(
        "preprod.size_analysis.compare.success",
        extra={"comparison_id": comparison.id},
    )

    # TODO: Status check/webhook/alerts
