from __future__ import annotations

from sentry.telemetry_classifiers.models import TelemetryClassifier
from sentry.telemetry_classifiers.prebuilt import PREBUILT_CLASSIFIERS
from sentry.telemetry_classifiers.types import ResolvedDefinition


class InvalidClassifierDefinition(Exception):
    """The classifier's configuration can't be executed. The message is safe to show users."""


def resolve_prebuilt_definition(key: str, dataset: str) -> ResolvedDefinition:
    prebuilt = PREBUILT_CLASSIFIERS.get(key)
    if prebuilt is None:
        raise InvalidClassifierDefinition("This prebuilt classifier doesn't exist.")
    if prebuilt.dataset != dataset:
        raise InvalidClassifierDefinition("This prebuilt classifier doesn't support this dataset.")

    return ResolvedDefinition(
        key=prebuilt.key,
        dataset=prebuilt.dataset,
        output_type=prebuilt.output_type,
    )


def resolve_classifier_definition(classifier: TelemetryClassifier) -> ResolvedDefinition:
    """Resolve a persisted classifier into an executable definition.

    Raises InvalidClassifierDefinition for configurations that can't run. Makes no telemetry
    queries or model calls.
    """
    # TODO: Resolve custom classifiers once their prompts can be executed.
    if classifier.prebuilt_classifier_key is None:
        raise InvalidClassifierDefinition("Custom classifiers aren't supported yet.")

    return resolve_prebuilt_definition(classifier.prebuilt_classifier_key, classifier.dataset)
