from __future__ import annotations

import logging
from collections.abc import Sequence

from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.preprod.size_analysis.utils import build_size_metrics_map, can_compare_size_metrics

logger = logging.getLogger(__name__)


def load_head_size_metrics(
    artifact_id: int, org_id: int, project_id: int
) -> list[PreprodArtifactSizeMetrics]:
    size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
        preprod_artifact_id=artifact_id,
        preprod_artifact__project__organization_id=org_id,
        preprod_artifact__project_id=project_id,
    ).select_related(
        "preprod_artifact",
        "preprod_artifact__mobile_app_info",
        "preprod_artifact__commit_comparison",
    )
    return list(size_metrics_qs)


def load_base_size_metrics(
    artifact_id: int, org_id: int, project_id: int
) -> list[PreprodArtifactSizeMetrics]:
    size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
        preprod_artifact_id=artifact_id,
        preprod_artifact__project__organization_id=org_id,
        preprod_artifact__project_id=project_id,
    ).select_related("preprod_artifact", "preprod_artifact__mobile_app_info")
    return list(size_metrics_qs)


def match_size_metrics(
    driving_metrics: Sequence[PreprodArtifactSizeMetrics],
    other_metrics: Sequence[PreprodArtifactSizeMetrics],
) -> tuple[
    list[tuple[PreprodArtifactSizeMetrics, PreprodArtifactSizeMetrics]],
    list[PreprodArtifactSizeMetrics],
]:
    """(driving, other) pairs sharing a metrics key, then the driving metrics with no match."""
    driving_metrics_map = build_size_metrics_map(list(driving_metrics))
    other_metrics_map = build_size_metrics_map(list(other_metrics))

    matched: list[tuple[PreprodArtifactSizeMetrics, PreprodArtifactSizeMetrics]] = []
    unmatched: list[PreprodArtifactSizeMetrics] = []
    for key, driving_metric in driving_metrics_map.items():
        other_metric = other_metrics_map.get(key)
        if other_metric:
            matched.append((driving_metric, other_metric))
        else:
            unmatched.append(driving_metric)
    return matched, unmatched


def pairs_with_artifact_as_head(
    artifact: PreprodArtifact, base_artifact: PreprodArtifact, org_id: int, project_id: int
) -> list[dict[str, PreprodArtifactSizeMetrics]]:
    size_metrics = _comparable_size_metrics(artifact, base_artifact, org_id, project_id)
    if size_metrics is None:
        return []
    head_size_metrics, base_size_metrics = size_metrics

    matched, unmatched_base_metrics = match_size_metrics(base_size_metrics, head_size_metrics)
    comparisons: list[dict[str, PreprodArtifactSizeMetrics]] = []
    for base_metric, head_metric in matched:
        _log_create_comparison(artifact, base_artifact)
        comparisons.append({"head_metric": head_metric, "base_metric": base_metric})
    for base_metric in unmatched_base_metrics:
        _log_no_matching_size_metric(artifact, base_metric)
    return comparisons


def pairs_with_artifact_as_base(
    artifact: PreprodArtifact, org_id: int, project_id: int
) -> tuple[list[dict[str, PreprodArtifactSizeMetrics]], set[int]]:
    """The comparisons against each head artifact, and the ids of the heads that got one."""
    comparisons: list[dict[str, PreprodArtifactSizeMetrics]] = []
    compared_head_artifact_ids: set[int] = set()

    head_artifacts = artifact.get_head_artifacts_for_commit()
    for head_artifact in head_artifacts:
        if head_artifact.build_configuration != artifact.build_configuration:
            logger.info(
                "preprod.size_analysis.compare.head_artifact_different_build_configurations",
                extra={
                    "head_artifact_id": head_artifact.id,
                    "base_artifact_id": artifact.id,
                },
            )
            continue

        head_comparisons = _pairs_for_head_artifact(head_artifact, artifact, org_id, project_id)
        if head_comparisons:
            comparisons.extend(head_comparisons)
            compared_head_artifact_ids.add(head_artifact.id)

    return comparisons, compared_head_artifact_ids


def _pairs_for_head_artifact(
    head_artifact: PreprodArtifact, base_artifact: PreprodArtifact, org_id: int, project_id: int
) -> list[dict[str, PreprodArtifactSizeMetrics]]:
    size_metrics = _comparable_size_metrics(head_artifact, base_artifact, org_id, project_id)
    if size_metrics is None:
        return []
    head_size_metrics, base_size_metrics = size_metrics

    matched, unmatched_head_metrics = match_size_metrics(head_size_metrics, base_size_metrics)
    comparisons: list[dict[str, PreprodArtifactSizeMetrics]] = []
    for head_metric, base_metric in matched:
        _log_create_comparison(head_artifact, base_artifact)
        comparisons.append({"head_metric": head_metric, "base_metric": base_metric})
    for head_metric in unmatched_head_metrics:
        _log_no_matching_size_metric(head_artifact, head_metric)
    return comparisons


def _comparable_size_metrics(
    head_artifact: PreprodArtifact, base_artifact: PreprodArtifact, org_id: int, project_id: int
) -> tuple[list[PreprodArtifactSizeMetrics], list[PreprodArtifactSizeMetrics]] | None:
    head_size_metrics = load_head_size_metrics(head_artifact.id, org_id, project_id)
    base_size_metrics = load_base_size_metrics(base_artifact.id, org_id, project_id)

    validation_result = can_compare_size_metrics(head_size_metrics, base_size_metrics)
    if not validation_result.can_compare:
        logger.info(
            "preprod.size_analysis.compare.cannot_compare_size_metrics",
            extra={
                "head_artifact_id": head_artifact.id,
                "base_artifact_id": base_artifact.id,
                "error_message": validation_result.error_message,
            },
        )
        return None
    return head_size_metrics, base_size_metrics


def _log_create_comparison(head_artifact: PreprodArtifact, base_artifact: PreprodArtifact) -> None:
    logger.info(
        "preprod.size_analysis.compare.create_comparison",
        extra={
            "head_artifact_id": head_artifact.id,
            "base_artifact_id": base_artifact.id,
        },
    )


def _log_no_matching_size_metric(
    head_artifact: PreprodArtifact, size_metric: PreprodArtifactSizeMetrics
) -> None:
    logger.info(
        "preprod.size_analysis.compare.no_matching_base_size_metric",
        extra={
            "head_artifact_id": head_artifact.id,
            "size_metric_id": size_metric.id,
        },
    )
