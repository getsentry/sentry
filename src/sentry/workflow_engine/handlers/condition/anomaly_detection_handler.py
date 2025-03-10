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
from sentry.incidents.utils.process_update_helpers import get_aggregation_value_helper
from sentry.net.http import connection_from_url
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
        snuba_query: SnubaQuery = subscription.snuba_query
        aggregation_value = get_aggregation_value_helper(update)

        extra_data = {
            "subscription_id": subscription.id,
            "organization_id": subscription.project.organization.id,
            "project_id": subscription.project_id,
            "detector_id": idk,  # some id here
        }

        anomaly_detection_config = AnomalyDetectionConfig(
            time_period=int(snuba_query.time_window / 60),
            sensitivity=sensitivity,
            direction=translate_direction(threshold_type),
            expected_seasonality=seasonality,
        )
        context = AlertInSeer(
            id=idk,  # some id here
            cur_window=TimeSeriesPoint(
                timestamp=subscription_update["timestamp"], value=aggregation_value
            ),
        )
        detect_anomalies_request = DetectAnomaliesRequest(
            organization_id=subscription.project.organization.id,
            project_id=subscription.project_id,
            config=anomaly_detection_config,
            context=context,
        )
        extra_data["dataset"] = snuba_query.dataset
        try:
            logger.info("Sending subscription update data to Seer", extra=extra_data)
            response = make_signed_seer_api_request(
                SEER_ANOMALY_DETECTION_CONNECTION_POOL,
                SEER_ANOMALY_DETECTION_ENDPOINT_URL,
                json.dumps(detect_anomalies_request).encode("utf-8"),
            )
        except (TimeoutError, MaxRetryError):
            logger.warning(
                "Timeout error when hitting anomaly detection endpoint", extra=extra_data
            )
            return None

        if response.status > 400:
            logger.error(
                "Error when hitting Seer detect anomalies endpoint",
                extra={
                    "response_data": response.data,
                    **extra_data,
                },
            )
            return None
        try:
            decoded_data = response.data.decode("utf-8")
        except AttributeError:
            logger.exception(
                "Failed to parse Seer anomaly detection response",
                extra={
                    "ad_config": anomaly_detection_config,
                    "context": context,
                    "response_data": response.data,
                    "response_code": response.status,
                },
            )
            return None

        try:
            results: DetectAnomaliesResponse = json.loads(decoded_data)
        except JSONDecodeError:
            logger.exception(
                "Failed to parse Seer anomaly detection response",
                extra={
                    "ad_config": anomaly_detection_config,
                    "context": context,
                    "response_data": decoded_data,
                    "response_code": response.status,
                },
            )
            return None

        if not results.get("success"):
            logger.error(
                "Error when hitting Seer detect anomalies endpoint",
                extra={
                    "error_message": results.get("message", ""),
                    **extra_data,
                },
            )
            return None

        ts = results.get("timeseries")
        if not ts:
            logger.warning(
                "Seer anomaly detection response returned no potential anomalies",
                extra={
                    "ad_config": anomaly_detection_config,
                    "context": context,
                    "response_data": results.get("message"),
                },
            )
            return None
        return ts
