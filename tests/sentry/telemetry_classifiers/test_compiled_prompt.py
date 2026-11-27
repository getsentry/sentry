from typing import Any

import pytest
from pydantic import ValidationError

from sentry.telemetry_classifiers.compiled_prompt import SeerDecisionPrompt
from sentry.telemetry_classifiers.types import TelemetryClassifierOutputType


def seer_decision(**question: Any) -> dict[str, Any]:
    return {
        "runner": "seer_decision",
        "version": 1,
        "question": {"type": "predicate", "instructions": "Is the user frustrated?", **question},
    }


def test_parses_seer_decision() -> None:
    prompt = SeerDecisionPrompt.parse_obj(seer_decision())

    assert prompt.question.instructions == "Is the user frustrated?"
    assert prompt.output_type == TelemetryClassifierOutputType.BINARY


@pytest.mark.parametrize(
    "compiled_prompt",
    [
        {**seer_decision(), "runner": "unknown"},
        {**seer_decision(), "version": 2},
        {**seer_decision(), "extra": True},
        seer_decision(instructions=""),
        seer_decision(type="choice"),
        seer_decision(name="match"),
    ],
)
def test_rejects_invalid_seer_decision(compiled_prompt: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        SeerDecisionPrompt.parse_obj(compiled_prompt)
