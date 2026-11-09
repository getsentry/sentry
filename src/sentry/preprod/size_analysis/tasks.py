from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, cast

from django.utils import timezone

from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.preprod.size_analysis.comparison_pairs import (
    load_base_size_metrics,
    load_head_size_metrics,
    match_size_metrics,
    pairs_with_artifact_as_base,
    pairs_with_artifact_as_head,
)
from sentry.preprod.size_analysis.comparison_run import (
    run_size_analysis_comparison,
    run_size_analysis_comparisons,
)
from sentry.preprod.size_analysis.monitors import maybe_emit_issues_from_diff_size_results
from sentry.preprod.size_analysis.utils import can_compare_size_metrics
from sentry.preprod.size_analysis.webhooks import send_size_analysis_webhook
from sentry.preprod.vcs.status_checks.size.tasks import create_preprod_status_check_task
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import preprod_size_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.preprod.tasks.compare_preprod_artifact_size_analysis",
    namespace=preprod_size_tasks,
    processing_deadline_duration=120,
    silo_mode=SiloMode.CELL,
)
def compare_preprod_artifact_size_analysis(
    project_id: int,
    org_id: int,
    artifact_id: int,
    triggered_at: str,
    **kwargs: Any,
) -> None:
    logger.info(
        "preprod.size_analysis.compare.start",
        extra={"preprod_artifact_id": artifact_id},
    )

    try:
        artifact: PreprodArtifact = PreprodArtifact.objects.get(
            id=artifact_id,
            project__organization_id=org_id,
            project_id=project_id,
        )
    except PreprodArtifact.DoesNotExist:
        logger.exception(
            "preprod.size_analysis.compare.artifact_not_found",
            extra={
                "preprod_artifact_id": artifact_id,
            },
        )
        return

    try:
        if artifact.commit_comparison:
            base_artifact = artifact.get_base_artifact_for_commit().first()
            if base_artifact and artifact.build_configuration != base_artifact.build_configuration:
                _skip_different_build_configuration(artifact, base_artifact, org_id)
                return

            _compare_with_commit_neighbours(artifact, base_artifact, org_id, project_id)
            _record_compare_duration(artifact, triggered_at)
        else:
            logger.info(
                "preprod.size_analysis.compare.artifact_no_commit_comparison",
                extra={"preprod_artifact_id": artifact_id},
            )
    finally:
        send_size_analysis_webhook(artifact=artifact, organization_id=org_id)

    # Evaluate sequential monitors unconditionally, independent of git metadata
    maybe_emit_issues_from_diff_size_results(artifact, org_id)


@instrumented_task(
    name="sentry.preprod.tasks.manual_size_analysis_comparison",
    namespace=preprod_size_tasks,
    processing_deadline_duration=120,
    silo_mode=SiloMode.CELL,
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

    _compare_manually_selected_artifacts(head_artifact, base_artifact, org_id, project_id)


def _skip_different_build_configuration(
    artifact: PreprodArtifact, base_artifact: PreprodArtifact, org_id: int
) -> None:
    logger.info(
        "preprod.size_analysis.compare.artifact_different_build_configurations",
        extra={
            "head_artifact_id": artifact.id,
            "base_artifact_id": base_artifact.id,
        },
    )
    # Update the status check even though we can't compare to avoid leaving it in a loading state
    create_preprod_status_check_task.apply_async(
        kwargs={
            "preprod_artifact_id": artifact.id,
            "caller": "compare_build_config_mismatch",
        }
    )
    # Still evaluate sequential monitors even on build config mismatch
    maybe_emit_issues_from_diff_size_results(artifact, org_id)


def _compare_with_commit_neighbours(
    artifact: PreprodArtifact, base_artifact: PreprodArtifact | None, org_id: int, project_id: int
) -> None:
    comparisons: list[dict[str, PreprodArtifactSizeMetrics]] = []
    follow_up_artifact_ids: set[int] = {artifact.id}

    # Create all comparisons with artifact as head
    if base_artifact:
        comparisons_as_head = pairs_with_artifact_as_head(
            artifact, base_artifact, org_id, project_id
        )
        comparisons.extend(comparisons_as_head)

    # Also create comparisons with artifact as base
    comparisons_as_base, compared_head_artifact_ids = pairs_with_artifact_as_base(
        artifact, org_id, project_id
    )
    comparisons.extend(comparisons_as_base)
    follow_up_artifact_ids.update(compared_head_artifact_ids)

    run_size_analysis_comparisons(org_id, comparisons, follow_up_artifact_ids)


def _record_compare_duration(artifact: PreprodArtifact, triggered_at: str) -> None:
    try:
        artifact_type = PreprodArtifact.ArtifactType(cast(int, artifact.artifact_type))
        artifact_type_name = artifact_type.name.lower()
    except (ValueError, AttributeError, TypeError):
        artifact_type_name = "unknown"

    e2e_size_analysis_compare_duration = timezone.now() - datetime.fromisoformat(triggered_at)
    metrics.distribution(
        "preprod.size_analysis.compare.results_e2e",
        e2e_size_analysis_compare_duration.total_seconds(),
        sample_rate=1.0,
        tags={
            "artifact_type": artifact_type_name,
        },
    )


def _compare_manually_selected_artifacts(
    head_artifact: PreprodArtifact, base_artifact: PreprodArtifact, org_id: int, project_id: int
) -> None:
    head_size_metrics = load_head_size_metrics(head_artifact.id, org_id, project_id)
    base_size_metrics = load_base_size_metrics(base_artifact.id, org_id, project_id)

    head_size_metrics_ids = [m.id for m in head_size_metrics]
    base_size_metrics_ids = [m.id for m in base_size_metrics]
    logger.info(
        "preprod.size_analysis.compare.manual.size_metrics",
        extra={
            "head_artifact_id": head_artifact.id,
            "base_artifact_id": base_artifact.id,
            "head_size_metrics_ids": head_size_metrics_ids,
            "base_size_metrics_ids": base_size_metrics_ids,
        },
    )

    validation_result = can_compare_size_metrics(head_size_metrics, base_size_metrics)
    if not validation_result.can_compare:
        logger.info(
            "preprod.size_analysis.compare.manual.cannot_compare_size_metrics",
            extra={
                "head_artifact_id": head_artifact.id,
                "base_artifact_id": base_artifact.id,
                "error_message": validation_result.error_message,
            },
        )
        return

    matched, unmatched_base_metrics = match_size_metrics(base_size_metrics, head_size_metrics)
    for base_metric, head_metric in matched:
        size_metric_id: int | None
        if head_metric.identifier:
            size_metric_id = head_metric.id
        else:
            size_metric_id = None
        logger.info(
            "preprod.size_analysis.compare.manual.running_comparison",
            extra={
                "head_artifact_id": head_artifact.id,
                "base_artifact_id": base_artifact.id,
                "size_metric_id": size_metric_id,
            },
        )
        run_size_analysis_comparison(org_id, head_metric, base_metric)
    for base_metric in unmatched_base_metrics:
        logger.info(
            "preprod.size_analysis.compare.manual.no_matching_base_size_metric",
            extra={"head_artifact_id": head_artifact.id, "size_metric_id": base_metric.id},
        )
