from __future__ import annotations

from sentry.telemetry_classifiers.types import Dataset, PrebuiltClassifier

# Development set only. The final list is decided in AGT-3252.
ALL_PREBUILT_CLASSIFIERS: tuple[PrebuiltClassifier, ...] = (
    PrebuiltClassifier(
        key="user_frustration",
        dataset=Dataset.CONVERSATION,
        name="User frustration",
        description="When your users become frustrated with the agent they are speaking with.",
        result_attribute="user_frustration",
    ),
    PrebuiltClassifier(
        key="tool_failure",
        dataset=Dataset.CONVERSATION,
        name="Tool failure",
        description="When a tool the agent calls fails or returns an error.",
        result_attribute="tool_failure",
    ),
    PrebuiltClassifier(
        key="task_failure",
        dataset=Dataset.CONVERSATION,
        name="Task failure",
        description="When the agent fails to complete the task the user asked for.",
        result_attribute="task_failure",
    ),
    PrebuiltClassifier(
        key="stuck_in_loop",
        dataset=Dataset.CONVERSATION,
        name="Stuck in a loop",
        description="When the agent repeats the same steps without making progress.",
        result_attribute="stuck_in_loop",
    ),
    PrebuiltClassifier(
        key="failed_operation",
        dataset=Dataset.TRACE_SPANS,
        name="Failed operation",
        description="When the operation a span measures fails or ends in an error.",
        result_attribute="failed_operation",
    ),
)

PREBUILT_CLASSIFIERS: dict[str, PrebuiltClassifier] = {
    classifier.key: classifier for classifier in ALL_PREBUILT_CLASSIFIERS
}
