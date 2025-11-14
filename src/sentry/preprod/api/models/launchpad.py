from __future__ import annotations

from typing import Annotated, Literal, int

from pydantic import BaseModel, ConfigDict, Field

from sentry.preprod.models import PreprodArtifactSizeMetrics

# For the API between launchpad and the monolith


class PutSizeFailed(BaseModel):
    model_config = ConfigDict()
    state: Literal[PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED] = (
        PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED
    )
    error_code: int
    error_message: str


class PutSizeProcessing(BaseModel):
    model_config = ConfigDict()
    state: Literal[PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING] = (
        PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING
    )


class PutSizePending(BaseModel):
    model_config = ConfigDict()
    state: Literal[PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING] = (
        PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING
    )


# Missing SizeAnalysisState.COMPLETED is on purpose. The only way to mark
# a size metrics as successful is via the assemble endpoint.
PutSize = Annotated[
    PutSizeFailed | PutSizePending | PutSizeProcessing,
    Field(discriminator="state"),
]
