import logging

from django.conf import settings
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.conf.server import SEER_ANOMALY_DETECTION_ENDPOINT_URL
from sentry.incidents.handlers.condition.anomaly_detection_handler import AnomalyDetectionUpdate
from sentry.incidents.models.alert_rule import AlertRule
from sentry.net.http import connection_from_url
from sentry.seer.anomaly_detection.types import (
    AlertInSeer,
    AnomalyDetectionConfig,
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
    DataSourceType,
    DetectAnomaliesRequest,
    DetectAnomaliesResponse,
    TimeSeriesPoint,
)
from sentry.seer.anomaly_detection.utils import translate_direction
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.utils import json, metrics
from sentry.utils.json import JSONDecodeError

logger = logging.getLogger(__name__)

SEER_ANOMALY_DETECTION_CONNECTION_POOL = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL,
    timeout=settings.SEER_ANOMALY_DETECTION_TIMEOUT,
)


# TODO: delete this once we deprecate the AlertRule model
def get_anomaly_data_from_seer_legacy(
    alert_rule: AlertRule,
    subscription: QuerySubscription,
    last_update: float,
    aggregation_value: float | None,
) -> list[TimeSeriesPoint] | None:
    snuba_query = alert_rule.snuba_query
    extra_data = {
        "subscription_id": subscription.id,
        "organization_id": subscription.project.organization_id,
        "project_id": subscription.project_id,
        "alert_rule_id": alert_rule.id,
        "threshold_type": alert_rule.threshold_type,
        "sensitivity": alert_rule.sensitivity,
        "seasonality": alert_rule.seasonality,
        "aggregation_value": aggregation_value,
    }
    if not snuba_query:
        logger.warning("Snuba query is empty", extra=extra_data)
        return None

    extra_data["dataset"] = snuba_query.dataset
    # XXX: we know we have these things because the serializer makes sure we do, but mypy insists
    if (
        alert_rule.threshold_type is None
        or not alert_rule.sensitivity
        or not alert_rule.seasonality
        or not snuba_query.time_window
    ):
        logger.info("Missing anomaly detection rule data", extra=extra_data)
        return None

    if not aggregation_value:
        metrics.incr("anomaly_detection.aggregation_value.none")
        logger.warning("Aggregation value is none", extra=extra_data)
        aggregation_value = 0

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
    data = json.dumps(detect_anomalies_request).encode("utf-8")
    update_log_data = extra_data.copy()
    update_log_data["data"] = data
    logger.info("Sending subscription update data to Seer", extra=update_log_data)
    try:
        response = make_signed_seer_api_request(
            SEER_ANOMALY_DETECTION_CONNECTION_POOL,
            SEER_ANOMALY_DETECTION_ENDPOINT_URL,
            data,
        )
    except (TimeoutError, MaxRetryError):
        logger.warning("Timeout error when hitting anomaly detection endpoint", extra=extra_data)
        return None

    if response.status > 400:
        logger.info(
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
        logger.info(
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


def get_anomaly_data_from_seer(
    sensitivity: AnomalyDetectionSensitivity,
    seasonality: AnomalyDetectionSeasonality,
    threshold_type: AnomalyDetectionThresholdType,
    subscription: QuerySubscription,
    subscription_update: AnomalyDetectionUpdate,
) -> list[TimeSeriesPoint] | None:
    snuba_query: SnubaQuery = subscription.snuba_query
    aggregation_value = subscription_update.get("value")
    source_id = subscription.id
    source_type = DataSourceType.SNUBA_QUERY_SUBSCRIPTION
    if aggregation_value is None:
        logger.error(
            "Invalid aggregation value", extra={"source_id": source_id, "source_type": source_type}
        )
        return None

    extra_data = {
        "subscription_id": subscription.id,
        "organization_id": subscription.project.organization_id,
        "project_id": subscription.project_id,
        "source_id": source_id,
        "source_type": source_type,
    }
    timestamp = subscription_update.get("timestamp")
    assert timestamp

    anomaly_detection_config = AnomalyDetectionConfig(
        time_period=int(snuba_query.time_window / 60),
        sensitivity=sensitivity,
        direction=translate_direction(threshold_type),
        expected_seasonality=seasonality,
    )
    context = AlertInSeer(
        id=None,
        source_id=source_id,
        source_type=source_type,
        cur_window=TimeSeriesPoint(timestamp=timestamp.timestamp(), value=aggregation_value),
    )
    detect_anomalies_request = DetectAnomaliesRequest(
        organization_id=subscription.project.organization_id,
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
