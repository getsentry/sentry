from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import (
    DataConditionHandler,
    DetectorPriorityLevel,
    WorkflowEventData,
)


@condition_handler_registry.register(Condition.ANOMALY_DETECTION)
class AnomalyDetectionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.DETECTOR_TRIGGER
    comparison_json_schema = {
        "type": "object",
        "properties": {
            "sensitivity": {
                "type": "string",
                "enum": [*AnomalyDetectionSensitivity],
            },
            "seasonality": {
                "type": "string",
                "enum": [*AnomalyDetectionSeasonality],
            },
            "threshold_type": {
                "type": "integer",
                "enum": [*AnomalyDetectionThresholdType],
            },
        },
        "required": ["sensitivity", "seasonality", "threshold_type"],
        "additionalProperties": False,
    }

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: int) -> DetectorPriorityLevel:
        # this is a placeholder
        return DetectorPriorityLevel.HIGH if event_data > 1 else DetectorPriorityLevel.OK
