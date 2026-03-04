from __future__ import annotations

import logging
from typing import Any, TypedDict

import sentry_sdk

from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.models.files.file import File
from sentry.preprod.api.models.public.shared import (
    AppInfoResponseDict,
    GitInfoResponseDict,
)
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.preprod.size_analysis.models import ComparisonResults
from sentry.preprod.size_analysis.utils import match_and_fetch_comparisons
from sentry.utils import json

logger = logging.getLogger(__name__)


class AppComponentResponseDict(TypedDict):
    componentType: str
    name: str
    appId: str
    path: str
    downloadSize: int
    installSize: int


class DiffItemResponseDict(TypedDict):
    sizeDiff: int
    headSize: int | None
    baseSize: int | None
    path: str
    itemType: str | None
    type: str
    # Recursive type (list[DiffItemResponseDict]) breaks drf-spectacular schema generation
    diffItems: list[Any] | None


class SizeMetricDiffResponseDict(TypedDict):
    metricsArtifactType: str
    identifier: str | None
    headInstallSize: int
    headDownloadSize: int
    baseInstallSize: int
    baseDownloadSize: int


class InsightDiffItemResponseDict(TypedDict):
    insightType: str
    status: str
    totalSavingsChange: int
    fileDiffs: list[DiffItemResponseDict]
    groupDiffs: list[DiffItemResponseDict]


# Keep in sync with internal models in sentry.preprod.size_analysis.models
class ComparisonResponseDict(TypedDict):
    metricsArtifactType: str
    identifier: str | None
    state: str
    errorCode: str | None
    errorMessage: str | None
    diffItems: list[DiffItemResponseDict] | None
    insightDiffItems: list[InsightDiffItemResponseDict] | None
    sizeMetricDiff: SizeMetricDiffResponseDict | None


class SizeAnalysisResponseDict(TypedDict):
    buildId: str
    state: str
    appInfo: AppInfoResponseDict
    gitInfo: GitInfoResponseDict | None
    errorCode: str | None
    errorMessage: str | None
    downloadSize: int | None
    installSize: int | None
    analysisDuration: float | None
    analysisVersion: str | None
    insights: dict[str, Any] | None
    appComponents: list[AppComponentResponseDict] | None
    baseBuildId: str | None
    baseAppInfo: AppInfoResponseDict | None
    comparisons: list[ComparisonResponseDict] | None


def build_comparison_data(
    base_artifact: PreprodArtifact,
    head_size_metrics: list[PreprodArtifactSizeMetrics],
) -> list[ComparisonResponseDict] | None:
    """Build comparison results for head vs base artifact."""
    base_size_metrics = list(
        PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact=base_artifact,
        ).select_related("preprod_artifact")
    )

    if not base_size_metrics:
        return None

    matched = match_and_fetch_comparisons(head_size_metrics, base_size_metrics)

    comparisons: list[ComparisonResponseDict] = []
    for match in matched:
        if not match.base_metric:
            comparisons.append(
                _build_failed_comparison(
                    match.head_metric,
                    "NO_BASE_METRIC",
                    "No matching base artifact size metric found.",
                )
            )
            continue

        if not match.comparison:
            continue

        comparison_result = _build_comparison_result(match.head_metric, match.comparison)
        comparisons.append(comparison_result)

    return comparisons if comparisons else None


def _build_failed_comparison(
    head_metric: PreprodArtifactSizeMetrics,
    error_code: str | None,
    error_message: str | None,
) -> ComparisonResponseDict:
    return {
        "metricsArtifactType": PreprodArtifactSizeMetrics.MetricsArtifactType(
            head_metric.metrics_artifact_type
        ).name,
        "identifier": head_metric.identifier,
        "state": PreprodArtifactSizeComparison.State.FAILED.name,
        "errorCode": error_code,
        "errorMessage": error_message,
        "diffItems": None,
        "insightDiffItems": None,
        "sizeMetricDiff": None,
    }


def _build_comparison_result(
    head_metric: PreprodArtifactSizeMetrics,
    comparison_obj: PreprodArtifactSizeComparison,
) -> ComparisonResponseDict:
    """Build a single comparison result."""
    if comparison_obj.state == PreprodArtifactSizeComparison.State.SUCCESS:
        return _build_success_comparison(head_metric, comparison_obj)
    elif comparison_obj.state == PreprodArtifactSizeComparison.State.FAILED:
        return _build_failed_comparison(
            head_metric,
            error_code=PreprodArtifactSizeComparison.ErrorCode(comparison_obj.error_code).name
            if comparison_obj.error_code is not None
            else None,
            error_message=comparison_obj.error_message,
        )
    else:
        return {
            "metricsArtifactType": PreprodArtifactSizeMetrics.MetricsArtifactType(
                head_metric.metrics_artifact_type
            ).name,
            "identifier": head_metric.identifier,
            "state": PreprodArtifactSizeComparison.State.PROCESSING.name,
            "errorCode": None,
            "errorMessage": None,
            "diffItems": None,
            "insightDiffItems": None,
            "sizeMetricDiff": None,
        }


def _build_success_comparison(
    head_metric: PreprodArtifactSizeMetrics,
    comparison_obj: PreprodArtifactSizeComparison,
) -> ComparisonResponseDict:
    """Build a comparison result with inlined diff data for SUCCESS state."""

    if comparison_obj.file_id is None:
        sentry_sdk.capture_message(
            "preprod.public_api.compare.success_no_file",
            level="warning",
            extra={"comparison_id": comparison_obj.id},
        )
        return _build_failed_comparison(head_metric, "FILE_ERROR", "Comparison file missing")

    try:
        file_obj = File.objects.get(id=comparison_obj.file_id)
        with file_obj.getfile() as fp:
            content = fp.read()
        comparison_data = json.loads(content)
        comparison_results = ComparisonResults(**comparison_data)

        comparison_dict = convert_dict_key_case(comparison_results.dict(), snake_to_camel_case)
        size_metric_diff = comparison_dict["sizeMetricDiffItem"]
        size_metric_diff["metricsArtifactType"] = PreprodArtifactSizeMetrics.MetricsArtifactType(
            size_metric_diff["metricsArtifactType"]
        ).name
        return {
            "metricsArtifactType": PreprodArtifactSizeMetrics.MetricsArtifactType(
                head_metric.metrics_artifact_type
            ).name,
            "identifier": head_metric.identifier,
            "state": PreprodArtifactSizeComparison.State.SUCCESS.name,
            "errorCode": None,
            "errorMessage": None,
            "diffItems": comparison_dict["diffItems"],
            "insightDiffItems": comparison_dict["insightDiffItems"],
            "sizeMetricDiff": size_metric_diff,
        }

    except File.DoesNotExist:
        sentry_sdk.capture_message(
            "preprod.public_api.compare.file_not_found",
            level="warning",
            extra={"comparison_id": comparison_obj.id, "file_id": comparison_obj.file_id},
        )
        return _build_failed_comparison(head_metric, "FILE_ERROR", "Comparison file not found")
    except Exception:
        logger.exception(
            "preprod.public_api.compare.parse_error",
            extra={"comparison_id": comparison_obj.id, "file_id": comparison_obj.file_id},
        )
        return _build_failed_comparison(
            head_metric, "PARSE_ERROR", "Failed to parse comparison data"
        )
