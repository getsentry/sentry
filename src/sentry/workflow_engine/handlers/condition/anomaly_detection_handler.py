from typing import Any

from sentry.incidents.models.alert_rule import (
    AlertRuleSeasonality,
    AlertRuleSensitivity,
    AlertRuleThresholdType,
)
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.ANOMALY_DETECTION)
class AnomalyDetectionHandler(DataConditionHandler[DataPacket]):
    type = [DataConditionHandler.Type.DETECTOR_TRIGGER]
    # MOVE SENSITIVITY AND STUFF HERE
    comparison_json_schema = {
        "type": "object",
        "properties": {
            "sensitivity": {
                "type": "string",
                "enum": [sensitivity.value for sensitivity in AlertRuleSensitivity],
            },
            "seasonality": {
                "type": "string",
                "enum": [seasonality.value for seasonality in AlertRuleSeasonality],
            },
            "threshold_type": {
                "type": "integer",
                "enum": [threshold_type.value for threshold_type in AlertRuleThresholdType],
            },
        },
    }

    # import has_anomaly, compare to comparison

    @staticmethod
    # this gets a subscription update
    # comparison should be bool ?
    def evaluate_value(update: DataPacket, comparison: Any) -> bool:
        # this is a placeholder
        return False
