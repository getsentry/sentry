from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum

from sentry.preprod.models import PreprodArtifactSizeMetrics

logger = logging.getLogger(__name__)


@dataclass
class ComparisonValidationResult:
    """Result of validating whether two sets of size metrics can be compared."""

    class ErrorType(str, Enum):
        """Types of comparison errors that can occur."""

        DIFFERENT_LENGTH = "different_length"
        DIFFERENT_APP_IDS = "different_app_ids"
        DIFFERENT_BUILD_CONFIGURATIONS = "different_build_configurations"
        DIFFERENT_METRICS = "different_metrics"

    can_compare: bool
    error_message: str | None = None
    error_type: ErrorType | None = None


# Build a mapping of (metrics_artifact_type, identifier) -> size metric for quick lookup of matching metrics from head or base size metrics
def build_size_metrics_map(
    metrics: list[PreprodArtifactSizeMetrics],
) -> dict[tuple[int | None, str | None], PreprodArtifactSizeMetrics]:
    return {(metric.metrics_artifact_type, metric.identifier): metric for metric in metrics}


def can_compare_size_metrics(
    head_metrics: list[PreprodArtifactSizeMetrics], base_metric: list[PreprodArtifactSizeMetrics]
) -> ComparisonValidationResult:
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
        return ComparisonValidationResult(
            can_compare=False,
            error_message=f"Head and base have different numbers of size metrics. Head has {len(head_metrics)} metric(s), base has {len(base_metric)} metric(s).",
            error_type=ComparisonValidationResult.ErrorType.DIFFERENT_LENGTH,
        )

    # Build sets of (metrics_artifact_type, identifier) for both lists
    head_set = {(m.metrics_artifact_type, m.identifier) for m in head_metrics}
    base_set = {(m.metrics_artifact_type, m.identifier) for m in base_metric}

    # Return True if the sets are equal (all metrics match on both dimensions)
    if head_set == base_set:
        return ComparisonValidationResult(can_compare=True)

    # Find the differences to provide detailed error message
    head_only = head_set - base_set
    base_only = base_set - head_set

    head_artifact_types = {m.metrics_artifact_type for m in head_metrics}
    base_artifact_types = {m.metrics_artifact_type for m in base_metric}
    head_identifiers = {m.identifier for m in head_metrics}
    base_identifiers = {m.identifier for m in base_metric}

    # Check if only identifiers differ (same artifact types)
    if head_artifact_types == base_artifact_types and head_identifiers != base_identifiers:
        error_type = ComparisonValidationResult.ErrorType.DIFFERENT_APP_IDS
    # Check if only artifact types differ (same identifiers)
    elif head_identifiers == base_identifiers and head_artifact_types != base_artifact_types:
        error_type = ComparisonValidationResult.ErrorType.DIFFERENT_BUILD_CONFIGURATIONS
    # Both differ or it's a complex mismatch
    else:
        error_type = ComparisonValidationResult.ErrorType.DIFFERENT_METRICS

    def format_metric_key(key: tuple[int | None, str | None]) -> str:
        artifact_type, identifier = key
        type_name = "Unknown"
        if artifact_type is not None:
            try:
                type_name = PreprodArtifactSizeMetrics.MetricsArtifactType(artifact_type).name
            except (ValueError, AttributeError):
                type_name = f"Type({artifact_type})"
        identifier_str = identifier if identifier else "(no identifier)"
        return f"{type_name}: {identifier_str}"

    error_parts = ["Head and base size metrics cannot be compared due to mismatched metrics."]

    if head_only:
        formatted_head = [format_metric_key(k) for k in head_only]
        error_parts.append(f"Head has metric(s) not in base: {', '.join(formatted_head)}")

    if base_only:
        formatted_base = [format_metric_key(k) for k in base_only]
        error_parts.append(f"Base has metric(s) not in head: {', '.join(formatted_base)}")

    error_message = " ".join(error_parts)

    logger.info(
        "preprod.size_analysis.compare.cannot_compare_size_metrics.sets_not_equal",
        extra={"head_set": head_set, "base_set": base_set, "error_message": error_message},
    )
    return ComparisonValidationResult(
        can_compare=False,
        error_message=error_message,
        error_type=error_type,
    )
