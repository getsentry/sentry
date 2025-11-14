from __future__ import annotations
from typing import int

import logging

from sentry.preprod.models import PreprodArtifactSizeMetrics

logger = logging.getLogger(__name__)


# Build a mapping of (metrics_artifact_type, identifier) -> size metric for quick lookup of matching metrics from head or base size metrics
def build_size_metrics_map(
    metrics: list[PreprodArtifactSizeMetrics],
) -> dict[tuple[int | None, str | None], PreprodArtifactSizeMetrics]:
    return {(metric.metrics_artifact_type, metric.identifier): metric for metric in metrics}


def can_compare_size_metrics(
    head_metrics: list[PreprodArtifactSizeMetrics], base_metric: list[PreprodArtifactSizeMetrics]
) -> bool:
    # Check that both lists have the same length
    if len(head_metrics) != len(base_metric):
        # TODO: Add ability to compare size metrics with different lengths
        logger.info(
            "preprod.size_analysis.compare.cannot_compare_size_metrics.different_length",
            extra={
                "head_metrics_length": len(head_metrics),
                "base_metric_length": len(base_metric),
            },
        )
        return False

    # Build sets of (metrics_artifact_type, identifier) for both lists
    head_set = {(m.metrics_artifact_type, m.identifier) for m in head_metrics}
    base_set = {(m.metrics_artifact_type, m.identifier) for m in base_metric}

    # Return True if the sets are equal (all metrics match on both dimensions)
    if head_set == base_set:
        return True

    logger.info(
        "preprod.size_analysis.compare.cannot_compare_size_metrics.sets_not_equal",
        extra={"head_set": head_set, "base_set": base_set},
    )
    return False
