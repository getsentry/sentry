from __future__ import annotations

from sentry.telemetry_classifiers.inference import CONVERSATION_USER_MESSAGES_BINARY
from sentry.telemetry_classifiers.types import (
    Dataset,
    PrebuiltClassifier,
    TelemetryClassifierOutputType,
)

# Only classifiers backed by a Seer model belong here.
ALL_PREBUILT_CLASSIFIERS: tuple[PrebuiltClassifier, ...] = (
    PrebuiltClassifier(
        key="conversation_user_frustration",
        dataset=Dataset.CONVERSATION,
        output_type=TelemetryClassifierOutputType.BINARY,
        contract=CONVERSATION_USER_MESSAGES_BINARY,
        name="User frustration",
        description="When your users become frustrated with the agent they are speaking with.",
        result_attribute="user_frustration",
    ),
)

PREBUILT_CLASSIFIERS: dict[str, PrebuiltClassifier] = {
    classifier.key: classifier for classifier in ALL_PREBUILT_CLASSIFIERS
}
