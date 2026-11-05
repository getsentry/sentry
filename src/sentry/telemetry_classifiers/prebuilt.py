from __future__ import annotations

from dataclasses import dataclass

from sentry.telemetry_classifiers.models import TelemetryClassifierDataset


@dataclass(frozen=True)
class PrebuiltClassifier:
    key: str
    dataset: TelemetryClassifierDataset
    name: str
    description: str
    # Attribute the classifier's output materializes into.
    result_attribute: str


# Development set only. The final list is decided in AGT-3252.
ALL_PREBUILT_CLASSIFIERS: tuple[PrebuiltClassifier, ...] = (
    PrebuiltClassifier(
        key="user_frustration",
        dataset=TelemetryClassifierDataset.CONVERSATION,
        name="User frustration",
        description="When your users become frustrated with the agent they are speaking with.",
        result_attribute="sentry.classifier.user_frustration",
    ),
    PrebuiltClassifier(
        key="tool_failure",
        dataset=TelemetryClassifierDataset.CONVERSATION,
        name="Tool failure",
        description="When a tool the agent calls fails or returns an error.",
        result_attribute="sentry.classifier.tool_failure",
    ),
    PrebuiltClassifier(
        key="task_failure",
        dataset=TelemetryClassifierDataset.CONVERSATION,
        name="Task failure",
        description="When the agent fails to complete the task the user asked for.",
        result_attribute="sentry.classifier.task_failure",
    ),
    PrebuiltClassifier(
        key="stuck_in_loop",
        dataset=TelemetryClassifierDataset.CONVERSATION,
        name="Stuck in a loop",
        description="When the agent repeats the same steps without making progress.",
        result_attribute="sentry.classifier.stuck_in_loop",
    ),
    PrebuiltClassifier(
        key="failed_operation",
        dataset=TelemetryClassifierDataset.TRACE_SPANS,
        name="Failed operation",
        description="When the operation a span measures fails or ends in an error.",
        result_attribute="sentry.classifier.failed_operation",
    ),
)

PREBUILT_CLASSIFIERS: dict[str, PrebuiltClassifier] = {
    classifier.key: classifier for classifier in ALL_PREBUILT_CLASSIFIERS
}
