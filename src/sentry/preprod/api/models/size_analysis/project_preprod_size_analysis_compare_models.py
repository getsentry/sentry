from __future__ import annotations

from pydantic import BaseModel

from sentry.preprod.api.models.project_preprod_build_details_models import BuildDetailsApiResponse
from sentry.preprod.models import PreprodArtifactSizeComparison, PreprodArtifactSizeMetrics


class SizeAnalysisComparison(BaseModel):
    head_size_metric_id: int
    base_size_metric_id: int | None = None

    metrics_artifact_type: PreprodArtifactSizeMetrics.MetricsArtifactType
    identifier: str | None = None
    state: PreprodArtifactSizeComparison.State

    # Only present when state is SUCCESS
    comparison_id: int | None = None

    # Only present when state is FAILED
    error_code: str | None = None
    error_message: str | None = None


class SizeAnalysisCompareGETResponse(BaseModel):
    head_build_details: BuildDetailsApiResponse
    base_build_details: BuildDetailsApiResponse
    comparisons: list[SizeAnalysisComparison]


class SizeAnalysisComparePOSTResponse(BaseModel):
    status: str
    message: str
    comparisons: list[SizeAnalysisComparison] | None = None
