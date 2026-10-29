from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from sentry.preprod.models import PreprodArtifactSizeMetrics

# For the API between launchpad and the monolith


class PutSizeFailed(BaseModel):
    state: Literal[PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED] = (
        PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED
    )
    error_code: int
    error_message: str


class PutSizeProcessing(BaseModel):
    state: Literal[PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING] = (
        PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING
    )


class PutSizePending(BaseModel):
    state: Literal[PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING] = (
        PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING
    )


# Missing SizeAnalysisState.COMPLETED and SizeAnalysisState.NOT_STARTED
# is on purpose.
# COMPLETED: The only way to mark a size metrics as successful is via
# the assemble endpoint.
# NOT_STARTED: Is launchpad is talking to us about SizeAnalysis then it
# was started.

PutSize = Annotated[
    PutSizeFailed | PutSizePending | PutSizeProcessing,
    Field(discriminator="state"),
]
