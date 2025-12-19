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


def _adjust_timestamps_for_time_window(
    data_points: list[TimeSeriesPoint] | list[AnomalyThresholdDataPoint],
    time_window_seconds: int,
    detector_created_at: float,
) -> None:
    """
    Adjust timestamps in-place to be one time window behind for data points
    that were created after the detector was created. Historical data points
    (before detector creation) remain unchanged.

    Seer returns end-of-bucket timestamps, but we want start-of-bucket timestamps
    for data points generated after the detector was created.
    """
    for point in data_points:
        if point["timestamp"] >= detector_created_at:
            point["timestamp"] = point["timestamp"] - time_window_seconds


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

    if aggregation_value is None or str(aggregation_value) == "nan":
        logger.warning(
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
        value = context["cur_window"]["value"]
        extra_data["value"] = value
        extra_data["value_str"] = str(value)  # Explicit string to catch NaN/Inf, just in case
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
        logger.warning("anomaly_threshold.timeout_error_hitting_seer_endpoint")
        return None

    if response.status >= 400:
        logger.error(
            "anomaly_threshold.seer_http_error",
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
            "anomaly_threshold.failed_to_parse_seer_detector_data_response",
            extra={
                "response_data": response.data,
                "payload": payload,
            },
        )
        return None

    if not results.get("success"):
        detailed_error_message = results.get("message", "<unknown>")
        logger.warning(
            "anomaly_threshold.seer_returned_failure",
            extra={"error_message": detailed_error_message},
        )
        return None

    data = results.get("data")
    if data:
        # Adjust timestamps to be one time window behind for data points after detector creation
        snuba_query: SnubaQuery = subscription.snuba_query
        _adjust_timestamps_for_time_window(
            data_points=data,
            time_window_seconds=snuba_query.time_window,
            detector_created_at=subscription.date_added.timestamp(),
        )
        logger.info(
            "anomaly_threshold.success",
            extra={
                "source_id": source_id,
                "source_type": source_type,
                "data_points_count": len(data),
            },
        )
    return data
