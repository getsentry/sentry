from __future__ import annotations

from typing import Any, Literal

from django.db import models
from django.db.backends.base.base import BaseDatabaseWrapper
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


class CompiledClassifierPromptField(models.JSONField):
    def get_db_prep_save(self, value: Any, connection: BaseDatabaseWrapper) -> Any:
        if value is not None and not hasattr(value, "resolve_expression"):
            value = SeerDecisionPrompt.validate(value).dict()
        return super().get_db_prep_save(value, connection)
