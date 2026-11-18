from typing import Any

import pytest

from sentry.telemetry_classifiers.definitions import (
    InvalidClassifierDefinition,
    resolve_classifier_definition,
)
from sentry.telemetry_classifiers.models import TelemetryClassifier
from sentry.telemetry_classifiers.types import (
    Dataset,
    ResolvedDefinition,
    TelemetryClassifierOutputType,
)
from sentry.testutils.cases import TestCase


class ResolveClassifierDefinitionTest(TestCase):
    def create_prebuilt(self, **kwargs: Any) -> TelemetryClassifier:
        return self.create_telemetry_classifier(
            project=self.project,
            prebuilt_classifier_key="conversation_user_frustration",
            natural_language_prompt=None,
            compiled_prompt=None,
            output_type=None,
            **kwargs,
        )

    def test_resolves_prebuilt_classifier(self) -> None:
        classifier = self.create_prebuilt()

        assert resolve_classifier_definition(classifier) == ResolvedDefinition(
            key="conversation_user_frustration",
            dataset=Dataset.CONVERSATION,
            output_type=TelemetryClassifierOutputType.BINARY,
        )

    def test_rejects_custom_classifier(self) -> None:
        classifier = self.create_telemetry_classifier(project=self.project)

        with pytest.raises(InvalidClassifierDefinition, match="Custom classifiers"):
            resolve_classifier_definition(classifier)

    def test_rejects_unknown_prebuilt_key(self) -> None:
        classifier = self.create_prebuilt()
        classifier.prebuilt_classifier_key = "user_frustration"

        with pytest.raises(InvalidClassifierDefinition, match="doesn't exist"):
            resolve_classifier_definition(classifier)

    def test_rejects_dataset_mismatch(self) -> None:
        classifier = self.create_prebuilt(dataset=Dataset.TRACE_SPANS)

        with pytest.raises(InvalidClassifierDefinition, match="doesn't support this dataset"):
            resolve_classifier_definition(classifier)
