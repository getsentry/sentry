import logging
from typing import Any

from django.conf import settings

from sentry.net.http import connection_from_url
from sentry.seer.anomaly_detection.get_anomaly_data import get_anomaly_data_from_seer
from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
    AnomalyType,
)
from sentry.snuba.models import QuerySubscription
from sentry.workflow_engine.models import Condition, DataPacket, DataSource
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, DetectorPriorityLevel

logger = logging.getLogger(__name__)

SEER_ANOMALY_DETECTION_CONNECTION_POOL = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL,
    timeout=settings.SEER_ANOMALY_DETECTION_TIMEOUT,
)

SEER_EVALUATION_TO_DETECTOR_PRIORITY = {
    AnomalyType.HIGH_CONFIDENCE.value: DetectorPriorityLevel.HIGH,
    AnomalyType.LOW_CONFIDENCE.value: DetectorPriorityLevel.MEDIUM,
    AnomalyType.NONE.value: DetectorPriorityLevel.OK,
}


# placeholder until we create this in the workflow engine model
class DetectorError(Exception):
    pass


@condition_handler_registry.register(Condition.ANOMALY_DETECTION)
class AnomalyDetectionHandler(DataConditionHandler[DataPacket]):
    group = DataConditionHandler.Group.DETECTOR_TRIGGER
    comparison_json_schema = {
        "type": "object",
        "properties": {
            "sensitivity": {
                "type": "string",
                "enum": [sensitivity.value for sensitivity in AnomalyDetectionSensitivity],
            },
            "seasonality": {
                "type": "string",
                "enum": [seasonality.value for seasonality in AnomalyDetectionSeasonality],
            },
            "threshold_type": {
                "type": "integer",
                "enum": [threshold_type.value for threshold_type in AnomalyDetectionThresholdType],
            },
        },
        "required": ["sensitivity", "seasonality", "threshold_type"],
        "additionalProperties": False,
    }

    @staticmethod
    def evaluate_value(update: DataPacket, comparison: Any) -> DetectorPriorityLevel:
        sensitivity = comparison["sensitivity"]
        seasonality = comparison["seasonality"]
        threshold_type = comparison["threshold_type"]

        subscription: QuerySubscription = QuerySubscription.objects.get(id=update.source_id)
        data_source = DataSource.objects.filter(
            source_id=update.source_id,
        ).first()
        if data_source is None:
            # this should not happen
            raise DetectorError("DataSource does not exist.")

        subscription_update = update.packet
        source_id = {
            "data_packet_source_id": update.source_id,
            "data_packet_type": data_source.type,
        }

        anomaly_data = get_anomaly_data_from_seer(
            sensitivity, seasonality, threshold_type, subscription, subscription_update, source_id
        )
        # covers both None and []
        if not anomaly_data:
            # something went wrong during evaluation
            raise DetectorError("Error during Seer data evaluation process.")

        anomaly_type = anomaly_data[0].get("anomaly", {}).get("anomaly_type")
        if anomaly_type == AnomalyType.NO_DATA.value:
            raise DetectorError("Project doesn't have enough data for detector to evaluate")
        elif anomaly_type is None:
            raise DetectorError("Seer response contained no evaluation data")

        return SEER_EVALUATION_TO_DETECTOR_PRIORITY[anomaly_type]
