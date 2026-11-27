from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from sentry.telemetry_classifiers.types import TelemetryClassifierOutputType

SEER_QUESTION_OUTPUT_TYPES = {
    "predicate": TelemetryClassifierOutputType.BINARY,
}


class PredicateQuestion(BaseModel):
    class Config:
        extra = "forbid"

    type: Literal["predicate"]
    instructions: str = Field(min_length=1)


class SeerDecisionPrompt(BaseModel):
    class Config:
        extra = "forbid"

    runner: Literal["seer_decision"]
    version: Literal[1]
    question: PredicateQuestion

    @property
    def output_type(self) -> TelemetryClassifierOutputType:
        return SEER_QUESTION_OUTPUT_TYPES[self.question.type]
