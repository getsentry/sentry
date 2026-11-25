from __future__ import annotations

from sentry.telemetry_classifiers.types import (
    Dataset,
    PrebuiltClassifier,
    TelemetryClassifierOutputType,
)

# Only classifiers backed by a Seer model belong here.
ALL_PREBUILT_CLASSIFIERS: tuple[PrebuiltClassifier, ...] = (
    PrebuiltClassifier(
        # Seer's one-shot id, also stored on existing classifiers. It predates the rename.
        key="conversation_user_frustration",
        dataset=Dataset.CONVERSATION,
        output_type=TelemetryClassifierOutputType.BINARY,
        name="Agent not helpful",
        description="When your agent fails to give users what they asked for.",
        result_attribute="user_frustration",
        binary_threshold=0.8,
    ),
)

PREBUILT_CLASSIFIERS: dict[str, PrebuiltClassifier] = {
    classifier.key: classifier for classifier in ALL_PREBUILT_CLASSIFIERS
}
