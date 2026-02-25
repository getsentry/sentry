from __future__ import annotations

import logging
from typing import Any, Literal, NotRequired, TypedDict

import sentry_sdk

from sentry.models.files.file import File
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.preprod.size_analysis.models import ComparisonResults
from sentry.preprod.size_analysis.utils import match_and_fetch_comparisons
from sentry.utils import json

logger = logging.getLogger(__name__)


class AppInfoResponseDict(TypedDict):
    appId: str | None
    name: str | None
    version: str | None
    buildNumber: int | None
    artifactType: int | None
    dateAdded: str | None
    dateBuilt: str | None


class GitInfoResponseDict(TypedDict):
    headSha: str | None
    baseSha: str | None
    provider: str | None
    headRepoName: str | None
    baseRepoName: str | None
    headRef: str | None
    baseRef: str | None
    prNumber: int | None


class AppComponentResponseDict(TypedDict):
    componentType: int
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
    metricsArtifactType: int
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
    metricsArtifactType: int
    identifier: str | None
    state: int
    errorCode: NotRequired[str | None]
    errorMessage: NotRequired[str | None]
    diffItems: NotRequired[list[DiffItemResponseDict] | None]
    insightDiffItems: NotRequired[list[InsightDiffItemResponseDict] | None]
    sizeMetricDiff: NotRequired[SizeMetricDiffResponseDict | None]


class SizeAnalysisPendingResponseDict(TypedDict):
    buildId: str
    state: Literal["PENDING"]
    appInfo: AppInfoResponseDict
    gitInfo: GitInfoResponseDict | None


class SizeAnalysisProcessingResponseDict(TypedDict):
    buildId: str
    state: Literal["PROCESSING"]
    appInfo: AppInfoResponseDict
    gitInfo: GitInfoResponseDict | None


class SizeAnalysisFailedResponseDict(TypedDict):
    buildId: str
    state: Literal["FAILED"]
    appInfo: AppInfoResponseDict
    gitInfo: GitInfoResponseDict | None
    errorCode: int | None
    errorMessage: str | None


class SizeAnalysisNotRanResponseDict(TypedDict):
    buildId: str
    state: Literal["NOT_RAN"]
    appInfo: AppInfoResponseDict
    gitInfo: GitInfoResponseDict | None
    errorCode: int | None
    errorMessage: str | None


# Keep in sync with internal models in sentry.preprod.size_analysis.models
class SizeAnalysisCompletedResponseDict(TypedDict):
    buildId: str
    state: Literal["COMPLETED"]
    appInfo: AppInfoResponseDict
    gitInfo: GitInfoResponseDict | None
    downloadSize: int
    installSize: int
    analysisDuration: float | None
    analysisVersion: str | None
    insights: NotRequired[dict[str, Any] | None]
    appComponents: NotRequired[list[AppComponentResponseDict] | None]
    baseBuildId: NotRequired[str | None]
    baseAppInfo: NotRequired[AppInfoResponseDict | None]
    comparisons: NotRequired[list[ComparisonResponseDict] | None]


SizeAnalysisResponseDict = (
    SizeAnalysisPendingResponseDict
    | SizeAnalysisProcessingResponseDict
    | SizeAnalysisFailedResponseDict
    | SizeAnalysisNotRanResponseDict
    | SizeAnalysisCompletedResponseDict
)


def create_app_info_dict(artifact: PreprodArtifact) -> dict[str, Any]:
    mobile_app_info = getattr(artifact, "mobile_app_info", None)

    return {
        "app_id": artifact.app_id,
        "name": mobile_app_info.app_name if mobile_app_info else None,
        "version": mobile_app_info.build_version if mobile_app_info else None,
        "build_number": mobile_app_info.build_number if mobile_app_info else None,
        "artifact_type": artifact.artifact_type,
        "date_added": artifact.date_added.isoformat() if artifact.date_added else None,
        "date_built": artifact.date_built.isoformat() if artifact.date_built else None,
    }


def create_git_info_dict(artifact: PreprodArtifact) -> dict[str, Any] | None:
    commit_comparison = getattr(artifact, "commit_comparison", None)
    if commit_comparison is None:
        return None

    return {
        "head_sha": commit_comparison.head_sha,
        "base_sha": commit_comparison.base_sha,
        "provider": commit_comparison.provider,
        "head_repo_name": commit_comparison.head_repo_name,
        "base_repo_name": commit_comparison.base_repo_name,
        "head_ref": commit_comparison.head_ref,
        "base_ref": commit_comparison.base_ref,
        "pr_number": commit_comparison.pr_number,
    }


def build_comparison_data(
    base_artifact: PreprodArtifact,
    head_size_metrics: list[PreprodArtifactSizeMetrics],
) -> list[dict[str, Any]] | None:
    """Build comparison results for head vs base artifact."""
    base_size_metrics = list(
        PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact=base_artifact,
        ).select_related("preprod_artifact")
    )

    if not base_size_metrics:
        return None

    matched = match_and_fetch_comparisons(head_size_metrics, base_size_metrics)

    comparisons: list[dict[str, Any]] = []
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
) -> dict[str, Any]:
    return {
        "metrics_artifact_type": head_metric.metrics_artifact_type,
        "identifier": head_metric.identifier,
        "state": PreprodArtifactSizeComparison.State.FAILED,
        "error_code": error_code,
        "error_message": error_message,
    }


def _build_comparison_result(
    head_metric: PreprodArtifactSizeMetrics,
    comparison_obj: PreprodArtifactSizeComparison,
) -> dict[str, Any]:
    """Build a single comparison result."""
    if comparison_obj.state == PreprodArtifactSizeComparison.State.SUCCESS:
        return _build_success_comparison(head_metric, comparison_obj)
    elif comparison_obj.state == PreprodArtifactSizeComparison.State.FAILED:
        return _build_failed_comparison(
            head_metric,
            error_code=str(comparison_obj.error_code)
            if comparison_obj.error_code is not None
            else None,
            error_message=comparison_obj.error_message,
        )
    else:
        return {
            "metrics_artifact_type": head_metric.metrics_artifact_type,
            "identifier": head_metric.identifier,
            "state": PreprodArtifactSizeComparison.State.PROCESSING,
        }


def _build_success_comparison(
    head_metric: PreprodArtifactSizeMetrics,
    comparison_obj: PreprodArtifactSizeComparison,
) -> dict[str, Any]:
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

        comparison_dict = comparison_results.dict()
        return {
            "metrics_artifact_type": head_metric.metrics_artifact_type,
            "identifier": head_metric.identifier,
            "state": PreprodArtifactSizeComparison.State.SUCCESS,
            "diff_items": comparison_dict["diff_items"],
            "insight_diff_items": comparison_dict["insight_diff_items"],
            "size_metric_diff": comparison_dict["size_metric_diff_item"],
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
