import logging
from datetime import datetime
from typing import Any, TypedDict

from django.conf import settings

from sentry.net.http import connection_from_url
from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
    AnomalyType,
)
from sentry.snuba.models import QuerySubscription
from sentry.workflow_engine.models import Condition
from sentry.workflow_engine.models.data_condition import DataConditionEvaluationException
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, DetectorPriorityLevel

logger = logging.getLogger(__name__)

SEER_ANOMALY_DETECTION_CONNECTION_POOL = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL,
    timeout=settings.SEER_ANOMALY_DETECTION_TIMEOUT,
)

SEER_EVALUATION_TO_DETECTOR_PRIORITY = {
    AnomalyType.HIGH_CONFIDENCE.value: DetectorPriorityLevel.HIGH,
    AnomalyType.LOW_CONFIDENCE.value: DetectorPriorityLevel.OK,  # Seer doesn't support warning alerts yet
    AnomalyType.NONE.value: DetectorPriorityLevel.OK,
}


class AnomalyDetectionUpdate(TypedDict):
    value: int
    source_id: int
    subscription_id: int
    timestamp: datetime


@condition_handler_registry.register(Condition.ANOMALY_DETECTION)
class AnomalyDetectionHandler(DataConditionHandler[AnomalyDetectionUpdate]):
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
    def evaluate_value(update: AnomalyDetectionUpdate, comparison: Any) -> DetectorPriorityLevel:
        from sentry.seer.anomaly_detection.get_anomaly_data import get_anomaly_data_from_seer

        sensitivity = comparison["sensitivity"]
        seasonality = comparison["seasonality"]
        threshold_type = comparison["threshold_type"]

        source_id = update.get("source_id")
        assert source_id

        subscription: QuerySubscription = QuerySubscription.objects.get(id=int(source_id))

        anomaly_data = get_anomaly_data_from_seer(
            sensitivity=sensitivity,
            seasonality=seasonality,
            threshold_type=threshold_type,
            subscription=subscription,
            subscription_update=update,
        )
        # covers both None and []
        if not anomaly_data:
            # something went wrong during evaluation
            raise DataConditionEvaluationException("Error during Seer data evaluation process.")

        anomaly_type = anomaly_data[0].get("anomaly", {}).get("anomaly_type")
        if anomaly_type == AnomalyType.NO_DATA.value:
            raise DataConditionEvaluationException(
                "Project doesn't have enough data for detector to evaluate"
            )
        elif anomaly_type is None:
            raise DataConditionEvaluationException("Seer response contained no evaluation data")

        return SEER_EVALUATION_TO_DETECTOR_PRIORITY[anomaly_type]
