from __future__ import annotations

import logging
from typing import Annotated, Literal, TypedDict, cast

import sentry_sdk

from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.apidocs.descriptions import ApiDescription
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
from sentry.preprod.size_analysis.models import (
    ComparisonResults,
    DiffType,
    InsightDiffType,
    SizeAnalysisResults,
)
from sentry.preprod.size_analysis.utils import match_and_fetch_comparisons
from sentry.utils import json

logger = logging.getLogger(__name__)

# Names of PreprodArtifactSizeMetrics.MetricsArtifactType
MetricsArtifactTypeName = Literal[
    "MAIN_ARTIFACT", "WATCH_ARTIFACT", "ANDROID_DYNAMIC_FEATURE", "APP_CLIP_ARTIFACT"
]
# Names of PreprodArtifactSizeComparison.State
ComparisonStateName = Literal["PENDING", "PROCESSING", "SUCCESS", "FAILED"]
# Names of PreprodArtifactSizeMetrics.SizeAnalysisState
SizeAnalysisStateName = Literal["PENDING", "PROCESSING", "COMPLETED", "FAILED", "NOT_RAN"]


class AppComponentResponseDict(TypedDict):
    componentType: Annotated[MetricsArtifactTypeName, ApiDescription("Type of the component")]
    name: Annotated[str, ApiDescription("Name of the component")]
    appId: Annotated[str, ApiDescription("App identifier of the component")]
    path: Annotated[str, ApiDescription("Path of the component inside the build")]
    downloadSize: Annotated[int, ApiDescription("Download size of the component in bytes")]
    installSize: Annotated[int, ApiDescription("Install size of the component in bytes")]


class DiffItemResponseDict(TypedDict):
    sizeDiff: Annotated[
        int, ApiDescription("Size change in bytes between the base and head builds")
    ]
    headSize: Annotated[
        int | None,
        ApiDescription("Size in bytes in the head build. Null when the item was removed"),
    ]
    baseSize: Annotated[
        int | None, ApiDescription("Size in bytes in the base build. Null when the item was added")
    ]
    path: Annotated[str, ApiDescription("Path of the file or group")]
    itemType: Annotated[str | None, ApiDescription("Type of the file or group")]
    type: Annotated[DiffType, ApiDescription("How the item changed")]
    diffItems: Annotated[
        list[DiffItemResponseDict] | None,
        ApiDescription("Changes to the item's children, in the same shape"),
    ]


class SizeMetricDiffResponseDict(TypedDict):
    metricsArtifactType: Annotated[
        MetricsArtifactTypeName, ApiDescription("Type of the component the sizes are for")
    ]
    identifier: Annotated[
        str | None, ApiDescription("Identifier of the component, such as a dynamic feature name")
    ]
    headInstallSize: Annotated[int, ApiDescription("Install size of the head build in bytes")]
    headDownloadSize: Annotated[int, ApiDescription("Download size of the head build in bytes")]
    baseInstallSize: Annotated[int, ApiDescription("Install size of the base build in bytes")]
    baseDownloadSize: Annotated[int, ApiDescription("Download size of the base build in bytes")]


class InsightDiffItemResponseDict(TypedDict):
    insightType: Annotated[
        str, ApiDescription("Type of the insight, such as duplicate_files or large_images")
    ]
    status: Annotated[InsightDiffType, ApiDescription("How the insight changed")]
    totalSavingsChange: Annotated[
        int, ApiDescription("Change in the insight's potential savings in bytes")
    ]
    fileDiffs: Annotated[
        list[DiffItemResponseDict], ApiDescription("File-level changes for the insight")
    ]
    groupDiffs: Annotated[
        list[DiffItemResponseDict], ApiDescription("Group-level changes for the insight")
    ]


class ComparisonSummaryResponseDict(TypedDict):
    """Comparison data shared between the public API and the webhook."""

    metricsArtifactType: Annotated[
        MetricsArtifactTypeName, ApiDescription("Type of the component compared")
    ]
    identifier: Annotated[
        str | None, ApiDescription("Identifier of the component, such as a dynamic feature name")
    ]
    state: Annotated[ComparisonStateName, ApiDescription("State of the comparison")]
    errorCode: Annotated[str | None, ApiDescription("Error code when the comparison failed")]
    errorMessage: Annotated[str | None, ApiDescription("Error message when the comparison failed")]
    sizeMetricDiff: Annotated[
        SizeMetricDiffResponseDict | None,
        ApiDescription("Head and base sizes. Only set when the comparison succeeded"),
    ]


# Keep in sync with internal models in sentry.preprod.size_analysis.models
class ComparisonResponseDict(ComparisonSummaryResponseDict):
    diffItems: Annotated[
        list[DiffItemResponseDict] | None,
        ApiDescription("File and group size changes. Only set when the comparison succeeded"),
    ]
    insightDiffItems: Annotated[
        list[InsightDiffItemResponseDict] | None,
        ApiDescription("Changes to size insights. Only set when the comparison succeeded"),
    ]


class _SizeAnalysisBaseResponseDict(TypedDict):
    """Fields shared by the webhook summary and the full API response.

    Not used directly — subclassed by ``SizeAnalysisSummaryResponseDict`` and
    ``SizeAnalysisResponseDict`` which each add their own ``comparisons``
    field (different element types) plus any shape-specific extras.
    """

    buildId: Annotated[str, ApiDescription("ID of the build")]
    state: Annotated[SizeAnalysisStateName, ApiDescription("State of the size analysis")]
    appInfo: Annotated[AppInfoResponseDict, ApiDescription("App details of the build")]
    gitInfo: Annotated[
        GitInfoResponseDict | None,
        ApiDescription("Version control details of the build. Null when the build has none"),
    ]
    errorCode: Annotated[
        str | None, ApiDescription("Error code when the size analysis failed or didn't run")
    ]
    errorMessage: Annotated[
        str | None, ApiDescription("Error message when the size analysis failed or didn't run")
    ]
    downloadSize: Annotated[
        int | None,
        ApiDescription("Download size of the build in bytes. Only set when the analysis completed"),
    ]
    installSize: Annotated[
        int | None,
        ApiDescription("Install size of the build in bytes. Only set when the analysis completed"),
    ]
    analysisDuration: Annotated[
        float | None,
        ApiDescription(
            "How long the analysis took, in seconds. Only set when the analysis completed"
        ),
    ]
    analysisVersion: Annotated[
        str | None, ApiDescription("Version of the analyzer that produced the results")
    ]
    baseBuildId: Annotated[
        str | None,
        ApiDescription(
            "ID of the base build the build is compared against. Null when there's no comparison"
        ),
    ]
    baseAppInfo: Annotated[
        AppInfoResponseDict | None,
        ApiDescription("App details of the base build. Null when there's no comparison"),
    ]


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


class InsightFileResponseDict(TypedDict):
    filePath: Annotated[str, ApiDescription("Path of the file inside the build")]
    totalSavings: Annotated[int, ApiDescription("Potential savings for the file in bytes")]


class InsightFileGroupResponseDict(TypedDict):
    name: Annotated[str, ApiDescription("Name of the group")]
    files: Annotated[list[InsightFileResponseDict], ApiDescription("Files in the group")]
    totalSavings: Annotated[int, ApiDescription("Potential savings for the group in bytes")]


class FilesInsightResponseDict(TypedDict):
    totalSavings: Annotated[int, ApiDescription("Potential savings of the insight in bytes")]
    files: Annotated[list[InsightFileResponseDict], ApiDescription("Files the insight applies to")]


class GroupsInsightResponseDict(TypedDict):
    totalSavings: Annotated[int, ApiDescription("Potential savings of the insight in bytes")]
    groups: Annotated[
        list[InsightFileGroupResponseDict], ApiDescription("Groups of files the insight applies to")
    ]


class OptimizableImageFileResponseDict(TypedDict):
    filePath: Annotated[str, ApiDescription("Path of the image inside the build")]
    currentSize: Annotated[int, ApiDescription("Current size of the image in bytes")]
    minifySavings: Annotated[int, ApiDescription("Savings from minifying the image in bytes")]
    minifiedSize: Annotated[
        int | None, ApiDescription("Size of the minified image in bytes. Null when not computed")
    ]
    conversionSavings: Annotated[
        int, ApiDescription("Savings from converting the image to HEIC in bytes")
    ]
    heicSize: Annotated[
        int | None, ApiDescription("Size of the image as HEIC in bytes. Null when not computed")
    ]
    idiom: Annotated[
        str | None, ApiDescription("Asset catalog idiom of the image. Null outside asset catalogs")
    ]
    colorspace: Annotated[
        str | None,
        ApiDescription("Asset catalog color space of the image. Null outside asset catalogs"),
    ]


class ImageOptimizationInsightResponseDict(TypedDict):
    totalSavings: Annotated[int, ApiDescription("Potential savings of the insight in bytes")]
    optimizableFiles: Annotated[
        list[OptimizableImageFileResponseDict], ApiDescription("Images that can be optimized")
    ]


class StripBinaryFileResponseDict(TypedDict):
    filePath: Annotated[str, ApiDescription("Path of the binary inside the build")]
    debugSectionsSavings: Annotated[
        int, ApiDescription("Savings from stripping debug sections in bytes")
    ]
    symbolTableSavings: Annotated[
        int, ApiDescription("Savings from stripping the symbol table in bytes")
    ]
    totalSavings: Annotated[int, ApiDescription("Potential savings for the binary in bytes")]


class StripBinaryInsightResponseDict(TypedDict):
    totalSavings: Annotated[int, ApiDescription("Potential savings of the insight in bytes")]
    files: Annotated[
        list[StripBinaryFileResponseDict], ApiDescription("Binaries that can be stripped")
    ]
    totalDebugSectionsSavings: Annotated[
        int, ApiDescription("Savings from stripping debug sections of all binaries in bytes")
    ]
    totalSymbolTableSavings: Annotated[
        int, ApiDescription("Savings from stripping symbol tables of all binaries in bytes")
    ]


class VideoCompressionFileResponseDict(TypedDict):
    filePath: Annotated[str, ApiDescription("Path of the video inside the build")]
    totalSavings: Annotated[int, ApiDescription("Potential savings for the video in bytes")]
    recommendedCodec: Annotated[str, ApiDescription("Codec recommended for the video")]


class VideoCompressionInsightResponseDict(TypedDict):
    totalSavings: Annotated[int, ApiDescription("Potential savings of the insight in bytes")]
    files: Annotated[
        list[VideoCompressionFileResponseDict], ApiDescription("Videos that can be compressed")
    ]


# Keep in sync with AndroidInsightResults in sentry.preprod.size_analysis.models
class AndroidInsightsResponseDict(TypedDict):
    platform: Annotated[Literal["android"], ApiDescription("Platform of the build")]
    duplicateFiles: Annotated[
        GroupsInsightResponseDict | None, ApiDescription("Files that are duplicated")
    ]
    webpOptimization: Annotated[
        FilesInsightResponseDict | None, ApiDescription("Images that can be converted to WebP")
    ]
    largeImages: Annotated[FilesInsightResponseDict | None, ApiDescription("Large images")]
    largeVideos: Annotated[FilesInsightResponseDict | None, ApiDescription("Large videos")]
    largeAudio: Annotated[FilesInsightResponseDict | None, ApiDescription("Large audio files")]
    hermesDebugInfo: Annotated[
        FilesInsightResponseDict | None,
        ApiDescription("Hermes bytecode files that contain debug info"),
    ]
    multipleNativeLibraryArchs: Annotated[
        FilesInsightResponseDict | None,
        ApiDescription("Native libraries for architectures other than arm64-v8a"),
    ]


# Keep in sync with AppleInsightResults in sentry.preprod.size_analysis.models
class AppleInsightsResponseDict(TypedDict):
    platform: Annotated[Literal["apple"], ApiDescription("Platform of the build")]
    duplicateFiles: Annotated[
        GroupsInsightResponseDict | None, ApiDescription("Files that are duplicated")
    ]
    largeImages: Annotated[FilesInsightResponseDict | None, ApiDescription("Large images")]
    largeAudios: Annotated[FilesInsightResponseDict | None, ApiDescription("Large audio files")]
    largeVideos: Annotated[FilesInsightResponseDict | None, ApiDescription("Large videos")]
    stripBinary: Annotated[
        StripBinaryInsightResponseDict | None,
        ApiDescription("Binaries with debug sections or symbols that can be stripped"),
    ]
    localizedStringsMinify: Annotated[
        FilesInsightResponseDict | None,
        ApiDescription("Localized strings files with comments that can be stripped"),
    ]
    smallFiles: Annotated[
        FilesInsightResponseDict | None,
        ApiDescription("Files smaller than the file system block size"),
    ]
    looseImages: Annotated[
        GroupsInsightResponseDict | None,
        ApiDescription("Images that could move into an asset catalog"),
    ]
    hermesDebugInfo: Annotated[
        FilesInsightResponseDict | None,
        ApiDescription("Hermes bytecode files that contain debug info"),
    ]
    imageOptimization: Annotated[
        ImageOptimizationInsightResponseDict | None, ApiDescription("Images that can be optimized")
    ]
    mainBinaryExportedSymbols: Annotated[
        FilesInsightResponseDict | None,
        ApiDescription("Main binaries with export metadata that can be reduced"),
    ]
    unnecessaryFiles: Annotated[
        FilesInsightResponseDict | None, ApiDescription("Files that can be removed")
    ]
    audioCompression: Annotated[
        FilesInsightResponseDict | None, ApiDescription("Audio files that can be compressed")
    ]
    videoCompression: Annotated[
        VideoCompressionInsightResponseDict | None, ApiDescription("Videos that can be compressed")
    ]
    alternateIconsOptimization: Annotated[
        ImageOptimizationInsightResponseDict | None,
        ApiDescription("Alternate app icons that can be optimized"),
    ]


class SizeAnalysisResponseDict(_SizeAnalysisBaseResponseDict):
    insights: Annotated[
        AndroidInsightsResponseDict | AppleInsightsResponseDict | None,
        ApiDescription("Suggestions for reducing the build's size. Null when there are none"),
    ]
    appComponents: Annotated[
        list[AppComponentResponseDict] | None,
        ApiDescription(
            "Components of the build, such as watch apps or dynamic features, with their sizes"
        ),
    ]
    comparisons: Annotated[
        list[ComparisonResponseDict] | None,
        ApiDescription(
            "Size comparisons against the base build, one per component. Null when there's no base build"
        ),
    ]


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


def _metrics_artifact_type_name(value: int) -> MetricsArtifactTypeName:
    return cast(MetricsArtifactTypeName, PreprodArtifactSizeMetrics.MetricsArtifactType(value).name)


def _build_failed_comparison(
    head_metric: PreprodArtifactSizeMetrics,
    error_code: str | None,
    error_message: str | None,
) -> ComparisonResponseDict:
    assert head_metric.metrics_artifact_type is not None
    return {
        "metricsArtifactType": _metrics_artifact_type_name(head_metric.metrics_artifact_type),
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
    assert head_metric.metrics_artifact_type is not None
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
            "metricsArtifactType": _metrics_artifact_type_name(head_metric.metrics_artifact_type),
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
    assert head_metric.metrics_artifact_type is not None

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
            "metricsArtifactType": _metrics_artifact_type_name(head_metric.metrics_artifact_type),
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
        "platform": platform.value.upper() if platform is not None else None,
        "state": cast(SizeAnalysisStateName, state_enum.name),
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
        if main_metric.error_code is not None:
            try:
                response["errorCode"] = PreprodArtifactSizeMetrics.ErrorCode(
                    main_metric.error_code
                ).name
            except ValueError:
                raise SizeAnalysisSummaryBuildError(f"Invalid error code: {main_metric.error_code}")
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
