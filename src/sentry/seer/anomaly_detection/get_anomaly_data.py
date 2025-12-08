import logging

from django.conf import settings
from urllib3 import Retry
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.conf.server import (
    SEER_ANOMALY_DETECTION_ALERT_DATA_URL,
    SEER_ANOMALY_DETECTION_ENDPOINT_URL,
)
from sentry.incidents.handlers.condition.anomaly_detection_handler import AnomalyDetectionUpdate
from sentry.net.http import connection_from_url
from sentry.seer.anomaly_detection.types import (
    AlertInSeer,
    AnomalyDetectionConfig,
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
    AnomalyThresholdDataPoint,
    DataSourceType,
    DetectAnomaliesRequest,
    DetectAnomaliesResponse,
    SeerDetectorDataResponse,
    TimeSeriesPoint,
)
from sentry.seer.anomaly_detection.utils import translate_direction
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.utils import json
from sentry.utils.json import JSONDecodeError

logger = logging.getLogger(__name__)

SEER_ANOMALY_DETECTION_CONNECTION_POOL = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL,
    timeout=settings.SEER_ANOMALY_DETECTION_TIMEOUT,
)

SEER_RETRIES = Retry(total=2, backoff_factor=0.5)


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
            retries=SEER_RETRIES,
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
        detailed_error_message = results.get("message", "<unknown>")
        # We want Sentry to group them by error message.
        msg = f"Error when hitting Seer detect anomalies endpoint: {detailed_error_message}"
        logger.warning(msg, extra=extra_data)
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


def get_anomaly_threshold_data_from_seer(
    subscription: QuerySubscription,
    start: float,
    end: float,
) -> list[AnomalyThresholdDataPoint] | None:
    """
    Get anomaly detection threshold data from Seer for a specific query subscription and time range.
    Returns data points with yhat_lower and yhat_upper threshold values.
    """
    source_id = subscription.id
    source_type = DataSourceType.SNUBA_QUERY_SUBSCRIPTION

    payload = {
        "alert": {
            "id": None,
            "source_id": source_id,
            "source_type": source_type,
        },
        "start": start,
        "end": end,
    }
    try:
        response = make_signed_seer_api_request(
            connection_pool=SEER_ANOMALY_DETECTION_CONNECTION_POOL,
            path=SEER_ANOMALY_DETECTION_ALERT_DATA_URL,
            body=json.dumps(payload).encode("utf-8"),
        )
    except (TimeoutError, MaxRetryError):
        logger.warning("Timeout error when hitting anomaly detection detector data endpoint")
        return None

    if response.status >= 400:
        logger.error(
            "Error when hitting Seer detector data endpoint",
            extra={
                "response_data": response.data,
                "payload": payload,
                "status": response.status,
            },
        )
        return None

    try:
        results: SeerDetectorDataResponse = json.loads(response.data.decode("utf-8"))
    except JSONDecodeError:
        logger.exception(
            "Failed to parse Seer detector data response",
            extra={
                "response_data": response.data,
                "payload": payload,
            },
        )
        return None

    if not results.get("success"):
        detailed_error_message = results.get("message", "<unknown>")
        # We want Sentry to group them by error message.
        msg = f"Error when hitting Seer detector data endpoint: {detailed_error_message}"
        logger.warning(msg)
        return None

    return results.get("data")
