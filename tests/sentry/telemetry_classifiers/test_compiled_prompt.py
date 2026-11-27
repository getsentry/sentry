from typing import Any

import pytest
from pydantic import ValidationError

from sentry.telemetry_classifiers.compiled_prompt import SeerDecisionPrompt
from sentry.telemetry_classifiers.models import TelemetryClassifier
from sentry.telemetry_classifiers.types import TelemetryClassifierOutputType
from sentry.testutils.cases import TestCase


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


class CompiledClassifierPromptFieldTest(TestCase):
    def create_custom_classifier(self, compiled_prompt: Any) -> TelemetryClassifier:
        return self.create_telemetry_classifier(
            project=self.project,
            prebuilt_classifier_key=None,
            natural_language_prompt="Is the user frustrated?",
            output_type=TelemetryClassifierOutputType.BINARY,
            compiled_prompt=compiled_prompt,
        )

    def test_saves_valid_prompt(self) -> None:
        from_dict = self.create_custom_classifier(seer_decision())
        from_model = self.create_custom_classifier(SeerDecisionPrompt.parse_obj(seer_decision()))

        from_dict.refresh_from_db()
        from_model.refresh_from_db()
        assert from_dict.compiled_prompt == seer_decision()
        assert from_model.compiled_prompt == seer_decision()

    def test_rejects_invalid_prompt_on_create(self) -> None:
        with pytest.raises(ValidationError):
            self.create_custom_classifier(seer_decision(instructions=""))

    def test_rejects_invalid_prompt_on_save(self) -> None:
        classifier = self.create_custom_classifier(seer_decision())
        classifier.compiled_prompt = {**seer_decision(), "version": 2}

        with pytest.raises(ValidationError):
            classifier.save()

    def test_rejects_invalid_prompt_on_queryset_update(self) -> None:
        self.create_custom_classifier(seer_decision())

        with pytest.raises(ValidationError):
            TelemetryClassifier.objects.update(compiled_prompt={"runner": "unknown"})

    def test_rejects_invalid_prompt_on_bulk_update(self) -> None:
        classifier = self.create_custom_classifier(seer_decision())
        classifier.compiled_prompt = {"runner": "unknown"}

        with pytest.raises(ValidationError):
            TelemetryClassifier.objects.bulk_update([classifier], ["compiled_prompt"])
