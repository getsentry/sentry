from __future__ import annotations

import logging
from typing import Any, TypedDict

import sentry_sdk

from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.models.files.file import File
from sentry.preprod.api.models.public.shared import (
    AppInfoResponseDict,
    GitInfoResponseDict,
    create_app_info_dict,
    create_git_info_dict,
)
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.preprod.size_analysis.models import ComparisonResults, SizeAnalysisResults
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


class ComparisonSummaryResponseDict(TypedDict):
    """Comparison data shared between the public API and the webhook."""

    metricsArtifactType: str
    identifier: str | None
    state: str
    errorCode: str | None
    errorMessage: str | None
    sizeMetricDiff: SizeMetricDiffResponseDict | None


# Keep in sync with internal models in sentry.preprod.size_analysis.models
class ComparisonResponseDict(ComparisonSummaryResponseDict):
    diffItems: list[DiffItemResponseDict] | None
    insightDiffItems: list[InsightDiffItemResponseDict] | None


class _SizeAnalysisBaseResponseDict(TypedDict):
    """Fields shared by the webhook summary and the full API response.

    Not used directly — subclassed by ``SizeAnalysisSummaryResponseDict`` and
    ``SizeAnalysisResponseDict`` which each add their own ``comparisons``
    field (different element types) plus any shape-specific extras.
    """

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
    baseBuildId: str | None
    baseAppInfo: AppInfoResponseDict | None


class SizeAnalysisSummaryResponseDict(_SizeAnalysisBaseResponseDict):
    """Webhook payload shape — the public API response minus heavy fields.

    Includes ``organizationSlug``, ``projectSlug``, and ``platform`` as
    webhook-specific convenience fields for routing — these are not present
    in the public API response.
    """

    organizationSlug: str
    projectSlug: str
    platform: str | None
    comparisons: list[ComparisonSummaryResponseDict] | None


class SizeAnalysisResponseDict(_SizeAnalysisBaseResponseDict):
    """Full public API response shape."""

    insights: dict[str, Any] | None
    appComponents: list[AppComponentResponseDict] | None
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


class SizeAnalysisSummaryBuildError(Exception):
    """Raised when the summary builder encounters an unrecoverable data error."""

    pass


def build_comparison_summary_data(
    base_artifact: PreprodArtifact,
    head_size_metrics: list[PreprodArtifactSizeMetrics],
) -> list[ComparisonSummaryResponseDict] | None:
    """Build comparison summaries (API subset without diffItems/insightDiffItems)."""
    full_comparisons = build_comparison_data(base_artifact, head_size_metrics)
    if full_comparisons is None:
        return None
    return [
        ComparisonSummaryResponseDict(
            metricsArtifactType=c["metricsArtifactType"],
            identifier=c["identifier"],
            state=c["state"],
            errorCode=c["errorCode"],
            errorMessage=c["errorMessage"],
            sizeMetricDiff=c["sizeMetricDiff"],
        )
        for c in full_comparisons
    ]


def build_size_analysis_summary(
    head_artifact: PreprodArtifact,
    *,
    base_artifact: PreprodArtifact | None = None,
    size_metrics: list[PreprodArtifactSizeMetrics] | None = None,
) -> SizeAnalysisSummaryResponseDict | None:
    """
    Build a webhook-ready summary of size analysis results.

    Returns the same shape as the public Size Analysis API response, minus:
    - ``insights``
    - ``appComponents``
    - ``comparisons[].diffItems``
    - ``comparisons[].insightDiffItems``

    Returns ``None`` for non-terminal states (PENDING, PROCESSING, NOT_RAN)
    or when no size metrics exist.

    Raises :class:`SizeAnalysisSummaryBuildError` when analysis data cannot
    be loaded for a COMPLETED state.
    """
    if size_metrics is None:
        size_metrics = list(head_artifact.get_size_metrics())

    if not size_metrics:
        return None

    main_metric = next(
        (
            m
            for m in size_metrics
            if m.metrics_artifact_type
            == PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT
        ),
        size_metrics[0],
    )

    try:
        state_enum = PreprodArtifactSizeMetrics.SizeAnalysisState(main_metric.state)
    except ValueError:
        raise SizeAnalysisSummaryBuildError(f"Invalid size analysis state: {main_metric.state}")

    # Non-terminal states: don't fire webhook
    if state_enum in (
        PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
        PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING,
        PreprodArtifactSizeMetrics.SizeAnalysisState.NOT_RAN,
    ):
        return None

    platform = head_artifact.platform

    response: SizeAnalysisSummaryResponseDict = {
        "buildId": str(head_artifact.id),
        "organizationSlug": head_artifact.project.organization.slug,
        "projectSlug": head_artifact.project.slug,
        "platform": platform.value if platform is not None else None,
        "state": state_enum.name,
        "appInfo": create_app_info_dict(head_artifact),
        "gitInfo": create_git_info_dict(head_artifact),
        "errorCode": None,
        "errorMessage": None,
        "downloadSize": None,
        "installSize": None,
        "analysisDuration": None,
        "analysisVersion": None,
        "baseBuildId": None,
        "baseAppInfo": None,
        "comparisons": None,
    }

    if state_enum == PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED:
        response["errorCode"] = (
            PreprodArtifactSizeMetrics.ErrorCode(main_metric.error_code).name
            if main_metric.error_code is not None
            else None
        )
        response["errorMessage"] = main_metric.error_message
        return response

    # COMPLETED state — load analysis results from file
    analysis_file_id = main_metric.analysis_file_id
    if not analysis_file_id:
        raise SizeAnalysisSummaryBuildError(
            f"Missing analysis_file_id for completed metric {main_metric.id}"
        )

    try:
        file_obj = File.objects.get(id=analysis_file_id)
    except File.DoesNotExist:
        raise SizeAnalysisSummaryBuildError(f"Analysis file {analysis_file_id} not found")

    try:
        with file_obj.getfile() as fp:
            content = fp.read()
        analysis_data = json.loads(content)
        analysis_results = SizeAnalysisResults(**analysis_data)
    except SizeAnalysisSummaryBuildError:
        raise
    except Exception as e:
        raise SizeAnalysisSummaryBuildError(
            f"Failed to parse analysis file {analysis_file_id}: {e}"
        ) from e

    response["downloadSize"] = analysis_results.download_size
    response["installSize"] = analysis_results.install_size
    response["analysisDuration"] = analysis_results.analysis_duration
    response["analysisVersion"] = analysis_results.analysis_version

    if base_artifact:
        comparisons = build_comparison_summary_data(base_artifact, size_metrics)
        if comparisons:
            response["baseBuildId"] = str(base_artifact.id)
            response["baseAppInfo"] = create_app_info_dict(base_artifact)
            response["comparisons"] = comparisons

    return response
