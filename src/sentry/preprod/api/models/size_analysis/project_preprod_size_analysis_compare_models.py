from __future__ import annotations

from pydantic import BaseModel

from sentry.preprod.api.models.project_preprod_build_details_models import BuildDetailsApiResponse
from sentry.preprod.models import PreprodArtifactSizeComparison, PreprodArtifactSizeMetrics


class SizeAnalysisComparison(BaseModel):
    head_size_metric_id: int
    base_size_metric_id: int | None

    metrics_artifact_type: PreprodArtifactSizeMetrics.MetricsArtifactType
    identifier: str | None
    state: PreprodArtifactSizeComparison.State

    # Only present when state is SUCCESS
    comparison_id: int | None

    # Only present when state is FAILED
    error_code: str | None
    error_message: str | None


class SizeAnalysisCompareGETResponse(BaseModel):
    head_build_details: BuildDetailsApiResponse
    base_build_details: BuildDetailsApiResponse
    comparisons: list[SizeAnalysisComparison]


class SizeAnalysisComparePOSTResponse(BaseModel):
    status: str
    message: str
    comparisons: list[SizeAnalysisComparison] | None


class SizeAnalysisComparisonListItem(BaseModel):
    # The build the head build was compared against. Reuses the build-details
    # shape so the frontend can render it with existing build components.
    base_build_details: BuildDetailsApiResponse
    # Aggregate of the per-metric comparison states for this base build:
    # "success" | "processing" | "failed".
    state: str
    date_added: str
