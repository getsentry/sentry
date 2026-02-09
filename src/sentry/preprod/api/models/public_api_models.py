from __future__ import annotations

from typing import Annotated, Any, Literal, NotRequired, TypedDict

from pydantic import BaseModel, Field

from sentry.preprod.api.models.project_preprod_build_details_models import BuildDetailsAppInfo
from sentry.preprod.models import PreprodArtifactSizeComparison, PreprodArtifactSizeMetrics
from sentry.preprod.size_analysis.models import (
    AndroidInsightResults,
    AppComponent,
    AppleInsightResults,
    DiffItem,
    InsightDiffItem,
    SizeMetricDiffItem,
)


# TypedDict classes for OpenAPI documentation
class AppInfoResponseDict(TypedDict):
    app_id: str
    name: str | None
    version: str | None
    build_number: int | None
    artifact_type: int | None
    date_added: str
    date_built: str | None
    commit_sha: str | None


class SizeAnalysisPendingResponseDict(TypedDict):
    """Response when size analysis is pending."""

    build_id: str
    state: Literal["PENDING"]
    app_info: AppInfoResponseDict


class SizeAnalysisProcessingResponseDict(TypedDict):
    """Response when size analysis is processing."""

    build_id: str
    state: Literal["PROCESSING"]
    app_info: AppInfoResponseDict


class SizeAnalysisFailedResponseDict(TypedDict):
    """Response when size analysis failed."""

    build_id: str
    state: Literal["FAILED"]
    app_info: AppInfoResponseDict
    error_code: int | None
    error_message: str | None


class SizeAnalysisNotRanResponseDict(TypedDict):
    """Response when size analysis was not run."""

    build_id: str
    state: Literal["NOT_RAN"]
    app_info: AppInfoResponseDict
    error_code: int | None
    error_message: str | None


class SizeAnalysisCompletedResponseDict(TypedDict):
    """Response when size analysis completed successfully."""

    build_id: str
    state: Literal["COMPLETED"]
    app_info: AppInfoResponseDict
    download_size: int
    install_size: int
    analysis_duration: float | None
    analysis_version: str | None
    insights: NotRequired[dict[str, Any] | None]
    app_components: NotRequired[list[dict[str, Any]] | None]
    base_build_id: NotRequired[str | None]
    base_app_info: NotRequired[AppInfoResponseDict | None]
    comparisons: NotRequired[list[dict[str, Any]] | None]


# Union type for OpenAPI documentation
SizeAnalysisResponseDict = (
    SizeAnalysisPendingResponseDict
    | SizeAnalysisProcessingResponseDict
    | SizeAnalysisFailedResponseDict
    | SizeAnalysisNotRanResponseDict
    | SizeAnalysisCompletedResponseDict
)


# Pydantic models for runtime validation
class PublicComparisonResult(BaseModel):
    """A comparison result with inlined diff data when state is SUCCESS."""

    metrics_artifact_type: PreprodArtifactSizeMetrics.MetricsArtifactType
    identifier: str | None = None
    state: PreprodArtifactSizeComparison.State

    # Error info (when state == FAILED)
    error_code: str | None = None
    error_message: str | None = None

    # Diff results (inlined when state == SUCCESS)
    diff_items: list[DiffItem] | None = None
    insight_diff_items: list[InsightDiffItem] | None = None
    size_metric_diff: SizeMetricDiffItem | None = None


class SizeAnalysisPendingResponse(BaseModel):
    """Response when size analysis is pending."""

    state: Literal["PENDING"] = "PENDING"
    build_id: str
    app_info: BuildDetailsAppInfo


class SizeAnalysisProcessingResponse(BaseModel):
    """Response when size analysis is processing."""

    state: Literal["PROCESSING"] = "PROCESSING"
    build_id: str
    app_info: BuildDetailsAppInfo


class SizeAnalysisFailedResponse(BaseModel):
    """Response when size analysis failed."""

    state: Literal["FAILED"] = "FAILED"
    build_id: str
    app_info: BuildDetailsAppInfo
    error_code: int | None = None
    error_message: str | None = None


class SizeAnalysisNotRanResponse(BaseModel):
    """Response when size analysis was not run."""

    state: Literal["NOT_RAN"] = "NOT_RAN"
    build_id: str
    app_info: BuildDetailsAppInfo
    error_code: int | None = None
    error_message: str | None = None


class SizeAnalysisCompletedResponse(BaseModel):
    """Response when size analysis completed successfully."""

    state: Literal["COMPLETED"] = "COMPLETED"
    build_id: str
    app_info: BuildDetailsAppInfo
    download_size: int
    install_size: int
    analysis_duration: float | None = None
    analysis_version: str | None = None

    # Insights
    insights: (
        Annotated[AndroidInsightResults | AppleInsightResults, Field(discriminator="platform")]
        | None
    ) = None

    # App components (for modular apps - watch apps, extensions, dynamic features)
    app_components: list[AppComponent] | None = None

    # Comparison data (present when base artifact exists)
    base_build_id: str | None = None
    base_app_info: BuildDetailsAppInfo | None = None
    comparisons: list[PublicComparisonResult] | None = None


# Discriminated union for size analysis response
PublicSizeAnalysisResponse = Annotated[
    SizeAnalysisPendingResponse
    | SizeAnalysisProcessingResponse
    | SizeAnalysisFailedResponse
    | SizeAnalysisNotRanResponse
    | SizeAnalysisCompletedResponse,
    Field(discriminator="state"),
]
