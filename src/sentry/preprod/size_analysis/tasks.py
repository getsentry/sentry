import logging
from io import BytesIO

from django.db import router, transaction

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
from sentry.taskworker.namespaces import attachments_tasks
from sentry.utils.json import dumps_htmlsafe

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.preprod.tasks.compare_preprod_artifact_size_analysis",
    namespace=attachments_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.REGION,
)
def compare_preprod_artifact_size_analysis(
    project_id: int,
    org_id: int,
    artifact_id: int,
):
    logger.info(
        "preprod.size_analysis.compare.start",
        extra={"artifact_id": artifact_id},
    )

    try:
        artifact = PreprodArtifact.objects.get(
            id=artifact_id,
            project__organization_id=org_id,
            project_id=project_id,
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
    base_artifact = artifact.get_base_artifact_for_commit().first()
    if base_artifact:
        if artifact.build_configuration != base_artifact.build_configuration:
            logger.info(
                "preprod.size_analysis.compare.artifact_different_build_configurations",
                extra={"head_artifact_id": artifact_id, "base_artifact_id": base_artifact.id},
            )
            return

        base_size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact_id__in=[base_artifact.id],
            preprod_artifact__project__organization_id=org_id,
            preprod_artifact__project_id=project_id,
        ).select_related("preprod_artifact")
        base_size_metrics = list(base_size_metrics_qs)

        head_size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact_id__in=[artifact_id],
            preprod_artifact__project__organization_id=org_id,
            preprod_artifact__project_id=project_id,
        ).select_related("preprod_artifact")
        head_size_metrics = list(head_size_metrics_qs)

        if can_compare_size_metrics(head_size_metrics, base_size_metrics):

            base_metrics_map = build_size_metrics_map(base_size_metrics)
            head_metrics_map = build_size_metrics_map(head_size_metrics)

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
                    _run_size_analysis_comparison(org_id, matching_head_size_metric, base_metric)
                else:
                    logger.info(
                        "preprod.size_analysis.compare.no_matching_base_size_metric",
                        extra={"head_artifact_id": artifact_id, "size_metric_id": base_metric.id},
                    )
        else:
            logger.info(
                "preprod.size_analysis.compare.cannot_compare_size_metrics",
                extra={"head_artifact_id": artifact_id, "base_artifact_id": base_artifact.id},
            )

    # Also run comparisons with artifact as base
    head_artifacts = artifact.get_head_artifacts_for_commit()
    for head_artifact in head_artifacts:
        if head_artifact.build_configuration != artifact.build_configuration:
            logger.info(
                "preprod.size_analysis.compare.head_artifact_different_build_configurations",
                extra={"head_artifact_id": head_artifact.id, "base_artifact_id": artifact_id},
            )
            continue

        head_size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact_id__in=[head_artifact.id],
            preprod_artifact__project__organization_id=org_id,
            preprod_artifact__project_id=project_id,
        ).select_related("preprod_artifact")
        head_size_metrics = list(head_size_metrics_qs)

        base_size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact_id__in=[artifact_id],
            preprod_artifact__project__organization_id=org_id,
            preprod_artifact__project_id=project_id,
        ).select_related("preprod_artifact")
        base_size_metrics = list(base_size_metrics_qs)

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
                _run_size_analysis_comparison(org_id, head_metric, matching_base_size_metric)
            else:
                logger.info(
                    "preprod.size_analysis.compare.no_matching_base_size_metric",
                    extra={"head_artifact_id": head_artifact.id, "size_metric_id": head_metric.id},
                )


@instrumented_task(
    name="sentry.preprod.tasks.manual_size_analysis_comparison",
    namespace=attachments_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.REGION,
)
def manual_size_analysis_comparison(
    project_id: int,
    org_id: int,
    head_artifact_id: int,
    base_artifact_id: int,
):
    logger.info(
        "preprod.size_analysis.compare.manual.start",
        extra={"head_artifact_id": head_artifact_id, "base_artifact_id": base_artifact_id},
    )

    try:
        head_artifact = PreprodArtifact.objects.get(
            id=head_artifact_id,
            project__organization_id=org_id,
            project_id=project_id,
        )
    except PreprodArtifact.DoesNotExist:
        logger.exception(
            "preprod.size_analysis.compare.manual.head_artifact_not_found",
            extra={"head_artifact_id": head_artifact_id},
        )
        return

    try:
        base_artifact = PreprodArtifact.objects.get(
            id=base_artifact_id,
            project__organization_id=org_id,
            project_id=project_id,
        )
    except PreprodArtifact.DoesNotExist:
        logger.exception(
            "preprod.size_analysis.compare.manual.base_artifact_not_found",
            extra={"base_artifact_id": base_artifact_id},
        )
        return

    # Should never be hit as we block this in manual compare endpoint, but safety check just in case
    if head_artifact.build_configuration != base_artifact.build_configuration:
        logger.info(
            "preprod.size_analysis.compare.manual.different_build_configurations",
            extra={"head_artifact_id": head_artifact.id, "base_artifact_id": base_artifact.id},
        )
        return

    head_size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
        preprod_artifact_id__in=[head_artifact.id],
        preprod_artifact__project__organization_id=org_id,
        preprod_artifact__project_id=project_id,
    ).select_related("preprod_artifact")
    head_size_metrics = list(head_size_metrics_qs)

    base_size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
        preprod_artifact_id__in=[base_artifact.id],
        preprod_artifact__project__organization_id=org_id,
        preprod_artifact__project_id=project_id,
    ).select_related("preprod_artifact")
    base_size_metrics = list(base_size_metrics_qs)

    logger.info(
        "preprod.size_analysis.compare.manual.size_metrics",
        extra={
            "head_artifact_id": head_artifact.id,
            "base_artifact_id": base_artifact.id,
            "head_size_metrics_ids": [m.id for m in head_size_metrics],
            "base_size_metrics_ids": [m.id for m in base_size_metrics],
        },
    )

    if can_compare_size_metrics(head_size_metrics, base_size_metrics):

        base_metrics_map = build_size_metrics_map(base_size_metrics)
        head_metrics_map = build_size_metrics_map(head_size_metrics)

        for key, base_metric in base_metrics_map.items():
            matching_head_size_metric = head_metrics_map.get(key)
            if matching_head_size_metric:
                logger.info(
                    "preprod.size_analysis.compare.manual.running_comparison",
                    extra={
                        "head_artifact_id": head_artifact.id,
                        "base_artifact_id": base_artifact.id,
                        "size_metric_id": (
                            matching_head_size_metric.id
                            if matching_head_size_metric.identifier
                            else None
                        ),
                    },
                )
                _run_size_analysis_comparison(org_id, matching_head_size_metric, base_metric)
            else:
                logger.info(
                    "preprod.size_analysis.compare.manual.no_matching_base_size_metric",
                    extra={"head_artifact_id": head_artifact.id, "size_metric_id": base_metric.id},
                )
    else:
        logger.info(
            "preprod.size_analysis.compare.manual.cannot_compare_size_metrics",
            extra={"head_artifact_id": head_artifact.id, "base_artifact_id": base_artifact.id},
        )


def _run_size_analysis_comparison(
    org_id: int,
    head_size_metric: PreprodArtifactSizeMetrics,
    base_size_metric: PreprodArtifactSizeMetrics,
):
    comparison = None
    try:
        comparison = PreprodArtifactSizeComparison.objects.get(
            head_size_analysis=head_size_metric,
            base_size_analysis=base_size_metric,
            organization_id=org_id,
        )

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
            return

        # PENDING state - transition to PROCESSING
        if comparison.state == PreprodArtifactSizeComparison.State.PENDING:
            logger.info(
                "preprod.size_analysis.compare.transitioning_pending_to_processing",
                extra={
                    "head_artifact_size_metric_id": head_size_metric.id,
                    "base_artifact_size_metric_id": base_size_metric.id,
                },
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
            comparison = PreprodArtifactSizeComparison.objects.create(
                head_size_analysis=head_size_metric,
                base_size_analysis=base_size_metric,
                organization_id=org_id,
                state=PreprodArtifactSizeComparison.State.FAILED,
            )
            comparison.save()
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
        comparison.state = PreprodArtifactSizeComparison.State.FAILED
        comparison.save()
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
        with transaction.atomic(router.db_for_write(PreprodArtifactSizeComparison)):
            comparison.state = PreprodArtifactSizeComparison.State.FAILED
            comparison.save()
        return

    head_size_analysis_results = SizeAnalysisResults.parse_raw(head_analysis_file.getfile().read())
    base_size_analysis_results = SizeAnalysisResults.parse_raw(base_analysis_file.getfile().read())

    logger.info(
        "preprod.size_analysis.compare.running_comparison",
        extra={
            "head_artifact_size_metric_id": head_size_metric.id,
            "base_artifact_size_metric_id": base_size_metric.id,
        },
    )

    # Update existing PENDING comparison or create new one
    with transaction.atomic(router.db_for_write(PreprodArtifactSizeComparison)):
        if comparison:
            comparison.state = PreprodArtifactSizeComparison.State.PROCESSING
            comparison.save()
        else:
            logger.info(
                "preprod.size_analysis.compare.no_existing_comparison",
                extra={
                    "head_artifact_size_metric_id": head_size_metric.id,
                    "base_artifact_size_metric_id": base_size_metric.id,
                },
            )
            with transaction.atomic(router.db_for_write(PreprodArtifactSizeComparison)):
                comparison = PreprodArtifactSizeComparison.objects.create(
                    head_size_analysis=head_size_metric,
                    base_size_analysis=base_size_metric,
                    organization_id=org_id,
                    state=PreprodArtifactSizeComparison.State.FAILED,
                )
                comparison.save()
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

    with transaction.atomic(router.db_for_write(PreprodArtifactSizeComparison)):
        file = File.objects.create(
            name=str(comparison.id),
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
