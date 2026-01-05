from __future__ import annotations

import logging
from io import BytesIO
from typing import Any

from django.db import router, transaction
from django.utils import timezone

from sentry import features
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.files.file import File
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.preprod.size_analysis.compare import compare_size_analysis
from sentry.preprod.size_analysis.models import ComparisonResults, SizeAnalysisResults
from sentry.preprod.size_analysis.utils import build_size_metrics_map, can_compare_size_metrics
from sentry.preprod.vcs.status_checks.size.tasks import create_preprod_status_check_task
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import preprod_tasks
from sentry.utils import metrics
from sentry.utils.json import dumps_htmlsafe

from .issues import diff_to_occurrence

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.preprod.tasks.compare_preprod_artifact_size_analysis",
    namespace=preprod_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.REGION,
)
def compare_preprod_artifact_size_analysis(
    project_id: int,
    org_id: int,
    artifact_id: int,
    **kwargs: Any,
) -> None:
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

    comparisons = []
    preprod_artifact_status_check_updates = [artifact.id]

    # Create all comparisons with artifact as head
    base_artifact = artifact.get_base_artifact_for_commit().first()
    if base_artifact:
        if artifact.build_configuration != base_artifact.build_configuration:
            logger.info(
                "preprod.size_analysis.compare.artifact_different_build_configurations",
                extra={"head_artifact_id": artifact_id, "base_artifact_id": base_artifact.id},
            )
            # Update the status check even though we can't compare to avoid leaving it in a loading state
            create_preprod_status_check_task.apply_async(
                kwargs={
                    "preprod_artifact_id": artifact_id,
                }
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

        validation_result = can_compare_size_metrics(head_size_metrics, base_size_metrics)
        if validation_result.can_compare:

            base_metrics_map = build_size_metrics_map(base_size_metrics)
            head_metrics_map = build_size_metrics_map(head_size_metrics)

            for key, base_metric in base_metrics_map.items():
                matching_head_size_metric = head_metrics_map.get(key)
                if matching_head_size_metric:
                    logger.info(
                        "preprod.size_analysis.compare.create_comparison",
                        extra={
                            "head_artifact_id": artifact_id,
                            "base_artifact_id": base_artifact.id,
                        },
                    )
                    comparisons.append(
                        {"head_metric": matching_head_size_metric, "base_metric": base_metric},
                    )
                else:
                    logger.info(
                        "preprod.size_analysis.compare.no_matching_base_size_metric",
                        extra={"head_artifact_id": artifact_id, "size_metric_id": base_metric.id},
                    )
        else:
            logger.info(
                "preprod.size_analysis.compare.cannot_compare_size_metrics",
                extra={
                    "head_artifact_id": artifact_id,
                    "base_artifact_id": base_artifact.id,
                    "error_message": validation_result.error_message,
                },
            )

    # Also create comparisons with artifact as base
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

        validation_result = can_compare_size_metrics(head_size_metrics, base_size_metrics)
        if not validation_result.can_compare:
            logger.info(
                "preprod.size_analysis.compare.cannot_compare_size_metrics",
                extra={
                    "head_artifact_id": head_artifact.id,
                    "base_artifact_id": artifact_id,
                    "error_message": validation_result.error_message,
                },
            )
            continue

        head_metrics_map = build_size_metrics_map(head_size_metrics)
        base_metrics_map = build_size_metrics_map(base_size_metrics)

        for key, head_metric in head_metrics_map.items():
            matching_base_size_metric = base_metrics_map.get(key)
            if matching_base_size_metric:
                logger.info(
                    "preprod.size_analysis.compare.create_comparison",
                    extra={
                        "head_artifact_id": head_artifact.id,
                        "base_artifact_id": artifact.id,
                    },
                )
                comparisons.append(
                    {"head_metric": head_metric, "base_metric": matching_base_size_metric},
                )
                preprod_artifact_status_check_updates.append(head_artifact.id)
            else:
                logger.info(
                    "preprod.size_analysis.compare.no_matching_base_size_metric",
                    extra={"head_artifact_id": head_artifact.id, "size_metric_id": head_metric.id},
                )

    # Create PENDING comparison records in DB and run comparisons
    with transaction.atomic(router.db_for_write(PreprodArtifactSizeComparison)):
        for comp in comparisons:
            head_metric = comp["head_metric"]
            base_metric = comp["base_metric"]
            comparison = PreprodArtifactSizeComparison.objects.create(
                head_size_analysis=head_metric,
                base_size_analysis=base_metric,
                organization_id=org_id,
                state=PreprodArtifactSizeComparison.State.PENDING,
            )
            comparison.save()

            logger.info(
                "preprod.size_analysis.compare.running_comparison",
                extra={"head_metric_id": head_metric.id, "base_metric_id": base_metric.id},
            )
            _run_size_analysis_comparison(org_id, head_metric, base_metric)

        for artifact_id in preprod_artifact_status_check_updates:
            # Update all artifact's status check with the new comparison
            create_preprod_status_check_task.apply_async(
                kwargs={
                    "preprod_artifact_id": artifact_id,
                }
            )

    artifact_type_name = "unknown"
    if artifact.artifact_type is not None:
        try:
            artifact_type_name = PreprodArtifact.ArtifactType(artifact.artifact_type).name.lower()
        except (ValueError, AttributeError):
            artifact_type_name = "unknown"

    time_now = timezone.now()
    e2e_size_analysis_compare_duration = time_now - artifact.date_added
    metrics.distribution(
        "preprod.size_analysis.compare.results_e2e",
        e2e_size_analysis_compare_duration.total_seconds(),
        sample_rate=1.0,
        tags={
            "artifact_type": artifact_type_name,
        },
    )


@instrumented_task(
    name="sentry.preprod.tasks.manual_size_analysis_comparison",
    namespace=preprod_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.REGION,
)
def manual_size_analysis_comparison(
    project_id: int,
    org_id: int,
    head_artifact_id: int,
    base_artifact_id: int,
    **kwargs: Any,
) -> None:
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

    validation_result = can_compare_size_metrics(head_size_metrics, base_size_metrics)
    if validation_result.can_compare:

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
            extra={
                "head_artifact_id": head_artifact.id,
                "base_artifact_id": base_artifact.id,
                "error_message": validation_result.error_message,
            },
        )


def _run_size_analysis_comparison(
    org_id: int,
    head_size_metric: PreprodArtifactSizeMetrics,
    base_size_metric: PreprodArtifactSizeMetrics,
) -> None:
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
        return

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
        with transaction.atomic(router.db_for_write(PreprodArtifactSizeComparison)):
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
            logger.info(
                "preprod.size_analysis.compare.transitioning_pending_to_processing",
                extra={
                    "head_artifact_size_metric_id": head_size_metric.id,
                    "base_artifact_size_metric_id": base_size_metric.id,
                },
            )
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

    maybe_emit_issues(
        comparison_results=comparison_results,
        head_metric=head_size_metric,
        base_metric=base_size_metric,
    )

    logger.info(
        "preprod.size_analysis.compare.success",
        extra={"comparison_id": comparison.id},
    )


def maybe_emit_issues(
    comparison_results: ComparisonResults,
    head_metric: PreprodArtifactSizeMetrics,
    base_metric: PreprodArtifactSizeMetrics,
) -> None:
    try:
        _maybe_emit_issues(
            comparison_results=comparison_results, head_metric=head_metric, base_metric=base_metric
        )
    except Exception:
        logger.exception("Error emitting issues")


def _maybe_emit_issues(
    comparison_results: ComparisonResults,
    head_metric: PreprodArtifactSizeMetrics,
    base_metric: PreprodArtifactSizeMetrics,
) -> None:
    project = head_metric.preprod_artifact.project
    project_id = project.id
    organization_id = project.organization.id

    if not features.has("organizations:preprod-issues", project.organization):
        logger.info(
            "preprod.size_analysis.compare.issues.disabled",
            extra={
                "project_id": project_id,
                "organization_id": organization_id,
            },
        )
        return

    # TODO(EME-80): Make threshold configurable:
    arbitrary_threshold = 100 * 1024
    diff = comparison_results.size_metric_diff_item
    download_delta = diff.head_download_size - diff.base_download_size
    install_delta = diff.head_install_size - diff.base_install_size

    issue_count = 0

    if download_delta >= arbitrary_threshold:
        occurrence, event_data = diff_to_occurrence("download", diff, head_metric, base_metric)
        produce_occurrence_to_kafka(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=occurrence,
            event_data=event_data,
        )
        issue_count += 1

    if install_delta >= arbitrary_threshold:
        occurrence, event_data = diff_to_occurrence("install", diff, head_metric, base_metric)
        produce_occurrence_to_kafka(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=occurrence,
            event_data=event_data,
        )
        issue_count += 1

    logger.info(
        "preprod.size_analysis.compare.issues",
        extra={
            "project_id": project_id,
            "organization_id": organization_id,
            "issue_count": issue_count,
        },
    )
