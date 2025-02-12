import logging

from django.conf import settings
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.conf.server import SEER_ANOMALY_DETECTION_ENDPOINT_URL
from sentry.incidents.models.alert_rule import AlertRule
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
from sentry.snuba.models import QuerySubscription
from sentry.utils import json
from sentry.utils.json import JSONDecodeError

logger = logging.getLogger(__name__)

SEER_ANOMALY_DETECTION_CONNECTION_POOL = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL,
    timeout=settings.SEER_ANOMALY_DETECTION_TIMEOUT,
)


def get_anomaly_data_from_seer(
    alert_rule: AlertRule,
    subscription: QuerySubscription,
    last_update: float,
    aggregation_value: float | None,
) -> list[TimeSeriesPoint] | None:
    snuba_query = alert_rule.snuba_query
    if not snuba_query or aggregation_value in [None, "NULL_VALUE"]:
        return None

    # XXX: we know we have these things because the serializer makes sure we do, but mypy insists
    if (
        alert_rule.threshold_type is None
        or not alert_rule.sensitivity
        or not alert_rule.seasonality
        or not snuba_query.time_window
        or not aggregation_value
    ):
        return None

    anomaly_detection_config = AnomalyDetectionConfig(
        time_period=int(snuba_query.time_window / 60),
        sensitivity=alert_rule.sensitivity,
        direction=translate_direction(alert_rule.threshold_type),
        expected_seasonality=alert_rule.seasonality,
    )
    context = AlertInSeer(
        id=alert_rule.id,
        cur_window=TimeSeriesPoint(timestamp=last_update, value=aggregation_value),
    )
    detect_anomalies_request = DetectAnomaliesRequest(
        organization_id=subscription.project.organization.id,
        project_id=subscription.project_id,
        config=anomaly_detection_config,
        context=context,
    )
    extra_data = {
        "subscription_id": subscription.id,
        "dataset": snuba_query.dataset,
        "organization_id": subscription.project.organization.id,
        "project_id": subscription.project_id,
        "alert_rule_id": alert_rule.id,
    }
    try:
        logger.info("Sending subscription update data to Seer", extra=extra_data)
        response = make_signed_seer_api_request(
            SEER_ANOMALY_DETECTION_CONNECTION_POOL,
            SEER_ANOMALY_DETECTION_ENDPOINT_URL,
            json.dumps(detect_anomalies_request).encode("utf-8"),
        )
    except (TimeoutError, MaxRetryError):
        logger.warning("Timeout error when hitting anomaly detection endpoint", extra=extra_data)
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
