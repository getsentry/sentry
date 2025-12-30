import logging
from datetime import datetime, timedelta

from django.conf import settings
from urllib3 import Retry
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.conf.server import SEER_ANOMALY_DETECTION_ENDPOINT_URL
from sentry.net.http import connection_from_url
from sentry.seer.anomaly_detection.store_data import get_start_index
from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionConfig,
    DetectAnomaliesResponse,
    DetectHistoricalAnomaliesContext,
    DetectHistoricalAnomaliesRequest,
    TimeSeriesPoint,
)
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.utils import json
from sentry.utils.json import JSONDecodeError

logger = logging.getLogger(__name__)

seer_anomaly_detection_connection_pool = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL,
    timeout=settings.SEER_HISTORICAL_ANOMALY_DETECTION_TIMEOUT,
)

SEER_RETRIES = Retry(total=2, backoff_factor=0.5, status_forcelist=[408, 429, 502, 503, 504])


def handle_seer_error_responses(response, config, context, log_params):
    def log_statement(log_level, text, extra_data=None):
        log_data = {**log_params}
        if extra_data:
            log_data.update(**extra_data)
        if log_level == "error":
            logger.error(text, extra=log_data)
        elif log_level == "warning":
            logger.warning(text, extra=log_data)

    extra_response_data = {"response_data": response.data, "response_code": response.status}
    if response.status > 400:
        log_statement(
            "error", "Error when hitting Seer detect anomalies endpoint", extra_response_data
        )
        return True

    try:
        decoded_data = response.data.decode("utf-8")
    except AttributeError:
        extra_data = {**log_params, **extra_response_data}
        logger.exception("Failed to parse Seer anomaly detection response", extra=extra_data)
        return True

    try:
        results: DetectAnomaliesResponse = json.loads(decoded_data)
    except JSONDecodeError:
        extra_response_data["response_data"] = decoded_data
        log_statement(
            "exception", "Failed to parse Seer anomaly detection response", extra_response_data
        )
        return True

    if not results.get("success"):
        extra_data = {"response_data": results.get("message", "")}
        log_statement("error", "Error when hitting Seer detect anomalies endpoint", extra_data)
        return True

    if not results.get("timeseries"):
        extra_data = {
            "response_data": results.get("message"),
        }
        log_statement(
            "warning", "Seer anomaly detection response returned no potential anomalies", extra_data
        )
        return True
    return False


def get_historical_anomaly_data_from_seer_preview(
    current_data: list[TimeSeriesPoint],
    historical_data: list[TimeSeriesPoint],
    organization_id: int,
    project_id: int,
    config: AnomalyDetectionConfig,
) -> list | None:
    """
    Send current and historical timeseries data to Seer and return anomaly detection response on the current timeseries.
    Used for rendering the preview charts of anomaly detection alert rules.
    """
    # Check if historical data has at least seven days of data. Return early if not.
    MIN_DAYS = 7
    data_start_index = get_start_index(historical_data)
    if data_start_index == -1:
        return []

    data_start_time = datetime.fromtimestamp(historical_data[data_start_index]["timestamp"])
    data_end_time = datetime.fromtimestamp(historical_data[-1]["timestamp"])
    if data_end_time - data_start_time < timedelta(days=MIN_DAYS):
        return []

    # Send data to Seer
    context = DetectHistoricalAnomaliesContext(
        history=historical_data,
        current=current_data,
    )
    body = DetectHistoricalAnomaliesRequest(
        organization_id=organization_id,
        project_id=project_id,
        config=config,
        context=context,
    )
    extra_data = {
        "organization_id": organization_id,
        "project_id": project_id,
        "config": config,
        "context": context,
    }
    try:
        response = make_signed_seer_api_request(
            connection_pool=seer_anomaly_detection_connection_pool,
            path=SEER_ANOMALY_DETECTION_ENDPOINT_URL,
            body=json.dumps(body).encode("utf-8"),
            retries=SEER_RETRIES,
        )
    except (TimeoutError, MaxRetryError):
        logger.warning("Timeout error when hitting anomaly detection endpoint", extra=extra_data)
        return None

    error = handle_seer_error_responses(response, config, context, extra_data)
    if error:
        return None

    results: DetectAnomaliesResponse = json.loads(response.data.decode("utf-8"))
    return results.get("timeseries")
