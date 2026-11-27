from typing import Any

import pytest
from django.core.exceptions import ValidationError

from sentry.telemetry_classifiers.models import TelemetryClassifier
from sentry.telemetry_classifiers.types import TelemetryClassifierOutputType
from sentry.testutils.cases import TestCase

COMPILED_PROMPT = {
    "runner": "seer_decision",
    "version": 1,
    "question": {"type": "predicate", "instructions": "Is the user frustrated?"},
}


class TelemetryClassifierCompiledPromptTest(TestCase):
    def create_custom_classifier(self, compiled_prompt: Any) -> TelemetryClassifier:
        return self.create_telemetry_classifier(
            project=self.project,
            prebuilt_classifier_key=None,
            natural_language_prompt="Is the user frustrated?",
            output_type=TelemetryClassifierOutputType.BINARY,
            compiled_prompt=compiled_prompt,
        )

    def test_saves_valid_prompt(self) -> None:
        classifier = self.create_custom_classifier(COMPILED_PROMPT)

        classifier.refresh_from_db()
        assert classifier.compiled_prompt == COMPILED_PROMPT

    def test_rejects_invalid_prompt_on_create(self) -> None:
        with pytest.raises(ValidationError) as error:
            self.create_custom_classifier({**COMPILED_PROMPT, "version": 2})

        assert "compiled_prompt" in error.value.message_dict
        assert not TelemetryClassifier.objects.exists()

    def test_rejects_invalid_prompt_on_save(self) -> None:
        classifier = self.create_custom_classifier(COMPILED_PROMPT)
        classifier.compiled_prompt = {"runner": "unknown"}

        with pytest.raises(ValidationError):
            classifier.save()

        classifier.refresh_from_db()
        assert classifier.compiled_prompt == COMPILED_PROMPT
