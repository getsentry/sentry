import logging
from typing import Any

from django.conf import settings
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.conf.server import SEER_ANOMALY_DETECTION_ENDPOINT_URL
from sentry.incidents.models.alert_rule import (
    AlertRuleSeasonality,
    AlertRuleSensitivity,
    AlertRuleThresholdType,
)
from sentry.net.http import connection_from_url
from sentry.seer.anomaly_detection.get_anomaly_data import get_anomaly_data_from_seer
from sentry.seer.anomaly_detection.types import (
    AlertInSeer,
    AnomalyDetectionConfig,
    DetectAnomaliesRequest,
    DetectAnomaliesResponse,
    TimeSeriesPoint,
)
from sentry.seer.anomaly_detection.utils import translate_direction
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.utils import json
from sentry.utils.json import JSONDecodeError
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler

logger = logging.getLogger(__name__)

SEER_ANOMALY_DETECTION_CONNECTION_POOL = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL,
    timeout=settings.SEER_ANOMALY_DETECTION_TIMEOUT,
)


@condition_handler_registry.register(Condition.ANOMALY_DETECTION)
class AnomalyDetectionHandler(DataConditionHandler[DataPacket]):
    type = [DataConditionHandler.Type.DETECTOR_TRIGGER]
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
            # TODO: we'll probably want to remove the dependency on the old AlertRuleThresholdType type
            # What's the replacement?
            "threshold_type": {
                "type": "integer",
                "enum": [threshold_type.value for threshold_type in AlertRuleThresholdType],
            },
        },
        "required": ["sensitivity", "seasonality", "threshold_type"],
        "additionalProperties": False,
    }

    # import has_anomaly, compare to comparison

    @staticmethod
    def evaluate_value(update: DataPacket, comparison: Any) -> bool:
        sensitivity = comparison["sensitivity"]
        seasonality = comparison["seasonality"]
        threshold_type = comparison["threshold_type"]

        subscription: QuerySubscription = QuerySubscription.objects.get(id=update.source_id)
        subscription_update = update.packet

        anomaly_data = get_anomaly_data_from_seer(
            sensitivity, seasonality, threshold_type, subscription, subscription_update
        )
        if anomaly_data is None:
            # something went wrong during evaluation
            raise DetectorError("Error during Seer data evaluation process.")
