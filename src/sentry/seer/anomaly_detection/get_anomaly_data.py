import datetime
import logging

from django.conf import settings
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.conf.server import SEER_ANOMALY_DETECTION_ENDPOINT_URL
from sentry.incidents.logic import WARNING_TRIGGER_LABEL
from sentry.incidents.models.alert_rule import AlertRule
from sentry.net.http import connection_from_url
from sentry.seer.anomaly_detection.types import (
    AlertInSeer,
    AnomalyDetectionConfig,
    AnomalyType,
    DetectAnomaliesRequest,
    TimeSeriesPoint,
)
from sentry.seer.anomaly_detection.utils import translate_direction
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.snuba.models import QuerySubscription
from sentry.utils import json
from sentry.utils.json import JSONDecodeError

logger = logging.getLogger(__name__)


seer_anomaly_detection_connection_pool = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL,
    timeout=settings.SEER_ANOMALY_DETECTION_TIMEOUT,
)


def has_anomaly(anomaly: TimeSeriesPoint, label: str, has_fake_anomalies: bool) -> bool:
    """
    Helper function to determine whether we care about an anomaly based on the
    anomaly type and trigger type.
    """
    if has_fake_anomalies:
        return True

    anomaly_type = anomaly.get("anomaly", {}).get("anomaly_type")

    if anomaly_type == AnomalyType.HIGH_CONFIDENCE.value or (
        label == WARNING_TRIGGER_LABEL and anomaly_type == AnomalyType.LOW_CONFIDENCE.value
    ):
        return True
    return False


def anomaly_has_confidence(anomaly: TimeSeriesPoint) -> bool:
    """
    Helper function to determine whether we have the 7+ days of data necessary
    to detect anomalies/send alerts for dynamic alert rules.
    """
    anomaly_type = anomaly.get("anomaly", {}).get("anomaly_type")
    return anomaly_type != AnomalyType.NO_DATA.value


def get_anomaly_data_from_seer(
    alert_rule: AlertRule, subscription: QuerySubscription, aggregation_value: float | None
) -> None:
    anomaly_detection_config = AnomalyDetectionConfig(
        time_period=int(alert_rule.snuba_query.time_window / 60),
        sensitivity=alert_rule.sensitivity,
        direction=translate_direction(alert_rule.threshold_type),
        expected_seasonality=alert_rule.seasonality,
    )
    ############################
    now = datetime.datetime.now()
    ############################
    context = AlertInSeer(
        id=alert_rule.id,
        cur_window=TimeSeriesPoint(timestamp=now.timestamp(), value=aggregation_value),
    )
    detect_anomalies_request = DetectAnomaliesRequest(
        organization_id=subscription.project.organization.id,
        project_id=subscription.project_id,
        config=anomaly_detection_config,
        context=context,
    )
    try:
        response = make_signed_seer_api_request(
            seer_anomaly_detection_connection_pool,
            SEER_ANOMALY_DETECTION_ENDPOINT_URL,
            json.dumps(detect_anomalies_request).encode("utf-8"),
        )
    except (TimeoutError, MaxRetryError):
        logger.warning(
            "Timeout error when hitting anomaly detection endpoint",
            extra={
                "subscription_id": subscription.id,
                "dataset": subscription.snuba_query.dataset,
                "organization_id": subscription.project.organization.id,
                "project_id": subscription.project_id,
                "alert_rule_id": alert_rule.id,
            },
        )
        return None

    print("resp: ", response.status)

    if response.status != 200:
        logger.error(
            f"Received {response.status} when calling Seer endpoint {SEER_ANOMALY_DETECTION_ENDPOINT_URL}.",  # noqa
            extra={"response_data": response.data},
        )
        return None

    try:
        results = json.loads(response.data.decode("utf-8")).get("timeseries")
        if not results:
            logger.warning(
                "Seer anomaly detection response returned no potential anomalies",
                extra={
                    "ad_config": anomaly_detection_config,
                    "context": context,
                    "response_data": response.data,
                    "reponse_code": response.status,
                },
            )
            return None
        return results
    except (
        AttributeError,
        UnicodeError,
        JSONDecodeError,
    ):
        logger.exception(
            "Failed to parse Seer anomaly detection response",
            extra={
                "ad_config": anomaly_detection_config,
                "context": context,
                "response_data": response.data,
                "reponse_code": response.status,
            },
        )
        return None
