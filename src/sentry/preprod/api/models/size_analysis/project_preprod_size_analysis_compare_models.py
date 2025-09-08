from pydantic import BaseModel

from sentry.preprod.models import PreprodArtifactSizeComparison, PreprodArtifactSizeMetrics


class SizeAnalysisComparison(BaseModel):
    head_size_metric_id: int
    base_size_metric_id: int

    metrics_artifact_type: PreprodArtifactSizeMetrics.MetricsArtifactType
    identifier: str | None
    state: PreprodArtifactSizeComparison.State

    # Only present when state is SUCCESS
    comparison_id: int | None

    # Only present when state is FAILED
    error_code: str | None
    error_message: str | None


class SizeAnalysisCompareGETResponse(BaseModel):
    head_artifact_id: int
    base_artifact_id: int
    comparisons: list[SizeAnalysisComparison]


class SizeAnalysisComparePOSTResponse(BaseModel):
    status: str
    message: str
    existing_comparisons: list[SizeAnalysisComparison] | None
