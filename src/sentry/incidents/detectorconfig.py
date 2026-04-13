from sentry.incidents.grouptype import COMPARISON_DELTA_CHOICES, MetricIssueDetectorHandler
from sentry.incidents.metric_issue_detector import MetricIssueDetectorValidator
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.workflow_engine.types import DetectorSettings, DetectorType, detector_settings_registry

detector_settings_registry.register(
    DetectorType.METRIC_ISSUE,
    DetectorSettings(
        handler=MetricIssueDetectorHandler,
        validator=MetricIssueDetectorValidator,
        config_schema={
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "description": "A representation of a metric detector config dict",
            "type": "object",
            "required": ["detection_type"],
            "properties": {
                "comparison_delta": {
                    "type": ["integer", "null"],
                    "enum": COMPARISON_DELTA_CHOICES,
                },
                "detection_type": {
                    "type": "string",
                    "enum": [detection_type.value for detection_type in AlertRuleDetectionType],
                },
            },
        },
    ),
)
