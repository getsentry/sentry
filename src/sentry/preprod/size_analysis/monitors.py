from __future__ import annotations

import logging
from collections.abc import Iterable, Sequence

from django.db import router, transaction

from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.preprod.artifact_search import get_sequential_base_artifact
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.preprod.size_analysis.comparison_run import run_size_analysis_comparison
from sentry.preprod.size_analysis.grouptype import (
    PreprodSizeAnalysisGroupType,
    SizeAnalysisDataPacket,
    SizeAnalysisMetadata,
    SizeAnalysisValue,
)
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.processors.detector import process_detectors

# Threshold type categories for filtering detectors by path.
# These must stay in sync with the enum in PreprodSizeAnalysisGroupType.detector_settings.config_schema.
DIFF_THRESHOLD_TYPES = frozenset({"absolute_diff", "relative_diff"})
ABSOLUTE_THRESHOLD_TYPES = frozenset({"absolute"})

logger = logging.getLogger(__name__)


def maybe_emit_issues_from_diff_size_results(
    artifact: PreprodArtifact,
    org_id: int,
) -> None:
    try:
        _maybe_emit_issues_from_diff_size_results(artifact=artifact, org_id=org_id)
    except Exception:
        logger.exception("Error emitting issues from diff size results")


def maybe_emit_issues_from_absolute_size_results(
    head_metric: PreprodArtifactSizeMetrics,
) -> None:
    try:
        _maybe_emit_issues_from_absolute_size_results(head_metric=head_metric)
    except Exception:
        logger.exception("Error emitting issues from absolute size results")


def _maybe_emit_issues_from_diff_size_results(
    artifact: PreprodArtifact,
    org_id: int,
) -> None:
    project = artifact.project
    project_id = project.id

    detectors = _enabled_size_detectors(project_id)
    if not detectors:
        logger.info(
            "preprod.size_analysis.diff_results.no_detectors",
            extra={"project_id": project_id},
        )
        return

    detectors = [d for d in detectors if d.config.get("threshold_type") in DIFF_THRESHOLD_TYPES]
    if not detectors:
        logger.info(
            "preprod.size_analysis.diff_results.no_diff_detectors",
            extra={"project_id": project_id},
        )
        return

    head_metric = _completed_main_metric(artifact)
    if head_metric is None:
        logger.info(
            "preprod.size_analysis.diff_results.no_head_metrics",
            extra={"preprod_artifact_id": artifact.id},
        )
        return

    query_to_base = _resolve_sequential_bases(artifact, detectors, project.organization)
    base_artifacts = query_to_base.values()
    base_artifact_to_metric = _compare_against_bases(org_id, head_metric, base_artifacts)

    for detector in detectors:
        normalized_query = _normalized_query(detector)
        base_artifact = query_to_base.get(normalized_query)
        if base_artifact is None:
            logger.info(
                "preprod.size_analysis.diff_results.no_base",
                extra={"detector_id": detector.id, "preprod_artifact_id": artifact.id},
            )
            continue

        detector_base_metric = base_artifact_to_metric.get(base_artifact.id)
        if detector_base_metric is None:
            continue

        _evaluate_diff_detector(
            detector, artifact, head_metric, base_artifact, detector_base_metric
        )


def _maybe_emit_issues_from_absolute_size_results(
    head_metric: PreprodArtifactSizeMetrics,
) -> None:
    project = head_metric.preprod_artifact.project
    project_id = project.id

    detectors = _enabled_size_detectors(project_id)
    if not detectors:
        logger.info(
            "preprod.size_analysis.size_results.no_detectors",
            extra={"project_id": project_id},
        )
        return

    # Only process absolute detectors from the single-build path
    detectors = [d for d in detectors if d.config.get("threshold_type") in ABSOLUTE_THRESHOLD_TYPES]
    if not detectors:
        logger.info(
            "preprod.size_analysis.size_results.no_absolute_detectors",
            extra={"project_id": project_id},
        )
        return

    head_artifact = head_metric.preprod_artifact

    metadata: SizeAnalysisMetadata = {
        "platform": _get_platform(head_artifact),
        "head_metric_id": head_metric.id,
        "head_artifact_id": head_artifact.id,
        "head_artifact": head_artifact,
    }

    size_data: SizeAnalysisValue = {
        "head_install_size_bytes": _bytes_or_zero(head_metric.max_install_size),
        "head_download_size_bytes": _bytes_or_zero(head_metric.max_download_size),
        "metadata": metadata,
    }

    data_packet: SizeAnalysisDataPacket = DataPacket(
        source_id=f"preprod-size-analysis:{project_id}",
        packet=size_data,
    )

    logger.info(
        "preprod.size_analysis.size_results.process_detectors.starting",
        extra={
            "project_id": project_id,
            "detector_count": len(detectors),
        },
    )
    results = process_detectors(data_packet, detectors)
    logger.info(
        "preprod.size_analysis.size_results.process_detectors.completed",
        extra={
            "project_id": project_id,
            "detector_count": len(results),
        },
    )


def _enabled_size_detectors(project_id: int) -> list[Detector]:
    detectors = Detector.objects.filter(
        project_id=project_id,
        type=PreprodSizeAnalysisGroupType.slug,
        enabled=True,
    )
    return list(detectors)


def _completed_main_metric(artifact: PreprodArtifact) -> PreprodArtifactSizeMetrics | None:
    main_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
        preprod_artifact=artifact,
        metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
    ).select_related("preprod_artifact", "preprod_artifact__mobile_app_info")
    main_metrics = list(main_metrics_qs)
    if not main_metrics:
        return None
    return main_metrics[0]


def _normalized_query(detector: Detector) -> str:
    query = detector.config.get("query", "")
    if not query:
        return ""
    return query.strip()


def _resolve_sequential_bases(
    artifact: PreprodArtifact, detectors: Sequence[Detector], organization: Organization
) -> dict[str, PreprodArtifact | None]:
    """The sequential base artifact per unique detector query, None where there is none."""
    query_to_base: dict[str, PreprodArtifact | None] = {}
    for detector in detectors:
        normalized_query = _normalized_query(detector)
        if normalized_query not in query_to_base:
            try:
                base = get_sequential_base_artifact(artifact, normalized_query, organization)
            except InvalidSearchQuery:
                logger.exception(
                    "preprod.size_analysis.diff_results.invalid_query",
                    extra={"detector_id": detector.id, "query": normalized_query},
                )
                base = None
            query_to_base[normalized_query] = base
    return query_to_base


def _compare_against_bases(
    org_id: int,
    head_metric: PreprodArtifactSizeMetrics,
    base_artifacts: Iterable[PreprodArtifact | None],
) -> dict[int, PreprodArtifactSizeMetrics]:
    """The main metric per base artifact id, after running its comparison (persists file-level diffs)."""
    base_artifact_to_metric: dict[int, PreprodArtifactSizeMetrics] = {}
    seen_base_ids: set[int] = set()
    for base_artifact in base_artifacts:
        if base_artifact is None or base_artifact.id in seen_base_ids:
            continue
        seen_base_ids.add(base_artifact.id)

        base_metric = _completed_main_metric(base_artifact)
        if base_metric is None:
            continue
        base_artifact_to_metric[base_artifact.id] = base_metric

        with transaction.atomic(router.db_for_write(PreprodArtifactSizeComparison)):
            PreprodArtifactSizeComparison.objects.get_or_create(
                head_size_analysis=head_metric,
                base_size_analysis=base_metric,
                organization_id=org_id,
                defaults={"state": PreprodArtifactSizeComparison.State.PENDING},
            )
        run_size_analysis_comparison(org_id, head_metric, base_metric)

    return base_artifact_to_metric


def _evaluate_diff_detector(
    detector: Detector,
    artifact: PreprodArtifact,
    head_metric: PreprodArtifactSizeMetrics,
    base_artifact: PreprodArtifact,
    base_metric: PreprodArtifactSizeMetrics,
) -> None:
    metadata: SizeAnalysisMetadata = {
        "platform": _get_platform(artifact),
        "head_metric_id": head_metric.id,
        "base_metric_id": base_metric.id,
        "head_artifact_id": artifact.id,
        "base_artifact_id": base_artifact.id,
        "head_artifact": artifact,
        "base_artifact": base_artifact,
    }

    size_data: SizeAnalysisValue = {
        "head_install_size_bytes": _bytes_or_zero(head_metric.max_install_size),
        "head_download_size_bytes": _bytes_or_zero(head_metric.max_download_size),
        "base_install_size_bytes": _bytes_or_zero(base_metric.max_install_size),
        "base_download_size_bytes": _bytes_or_zero(base_metric.max_download_size),
        "metadata": metadata,
    }

    data_packet: SizeAnalysisDataPacket = DataPacket(
        source_id=f"preprod-size-analysis:{artifact.project_id}",
        packet=size_data,
    )

    logger.info(
        "preprod.size_analysis.diff_results.evaluating",
        extra={
            "detector_id": detector.id,
            "preprod_artifact_id": artifact.id,
            "base_artifact_id": base_artifact.id,
        },
    )
    process_detectors(data_packet, [detector])


def _get_platform(artifact: PreprodArtifact) -> str:
    return artifact.platform or "unknown"


def _bytes_or_zero(size_bytes: int | None) -> int:
    if size_bytes is None:
        return 0
    return size_bytes
