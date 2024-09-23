import logging
from datetime import datetime, timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from parsimonious.exceptions import ParseError
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.conf.server import SEER_ANOMALY_DETECTION_STORE_DATA_URL
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleStatus
from sentry.models.project import Project
from sentry.net.http import connection_from_url
from sentry.seer.anomaly_detection.types import (
    AlertInSeer,
    AnomalyDetectionConfig,
    StoreDataRequest,
    StoreDataResponse,
    TimeSeriesPoint,
)
from sentry.seer.anomaly_detection.utils import (
    fetch_historical_data,
    format_historical_data,
    translate_direction,
)
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.snuba.models import SnubaQuery
from sentry.snuba.utils import get_dataset
from sentry.utils import json
from sentry.utils.json import JSONDecodeError

logger = logging.getLogger(__name__)

seer_anomaly_detection_connection_pool = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL,
    timeout=settings.SEER_ANOMALY_DETECTION_TIMEOUT,
)
NUM_DAYS = 28


def _get_start_and_end_indices(data: list[TimeSeriesPoint]) -> tuple[int, int]:
    """
    Helper to return the first and last data points that have event counts.
    Used to determine whether we have at least a week's worth of data.
    """
    start, end = -1, -1
    indices_with_results = []
    for i, datum in enumerate(data):
        if datum.get("value", 0) != 0:
            indices_with_results.append(i)
    if not indices_with_results:
        return start, end

    start = indices_with_results[0]
    end = indices_with_results[-1]
    assert start <= end
    return start, end


def send_historical_data_to_seer(alert_rule: AlertRule, project: Project) -> AlertRuleStatus:
    """
    Get 28 days of historical data and pass it to Seer to be used for prediction anomalies on the alert.
    """
    snuba_query = SnubaQuery.objects.get(id=alert_rule.snuba_query_id)
    window_min = int(snuba_query.time_window / 60)
    dataset = get_dataset(snuba_query.dataset)
    historical_data = fetch_historical_data(alert_rule, snuba_query, project)

    if not historical_data:
        raise ValidationError("No historical data available.")

    formatted_data = format_historical_data(historical_data, dataset)
    if not formatted_data:
        raise ValidationError("Unable to get historical data for this alert.")

    if (
        not alert_rule.sensitivity
        or not alert_rule.seasonality
        or alert_rule.threshold_type is None
        or alert_rule.organization is None
    ):
        # this won't happen because we've already gone through the serializer, but mypy insists
        raise ValidationError("Missing expected configuration for a dynamic alert.")

    anomaly_detection_config = AnomalyDetectionConfig(
        time_period=window_min,
        sensitivity=alert_rule.sensitivity,
        direction=translate_direction(alert_rule.threshold_type),
        expected_seasonality=alert_rule.seasonality,
    )
    alert = AlertInSeer(id=alert_rule.id)
    body = StoreDataRequest(
        organization_id=alert_rule.organization.id,
        project_id=project.id,
        alert=alert,
        config=anomaly_detection_config,
        timeseries=formatted_data,
    )
    logger.info(
        "Sending data to Seer's store data endpoint",
        extra={
            "ad_config": anomaly_detection_config,
            "alert": alert_rule.id,
            "dataset": snuba_query.dataset,
            "aggregate": snuba_query.aggregate,
            "meta": json.dumps(historical_data.data.get("meta", {}).get("fields", {})),
        },
    )
    try:
        response = make_signed_seer_api_request(
            connection_pool=seer_anomaly_detection_connection_pool,
            path=SEER_ANOMALY_DETECTION_STORE_DATA_URL,
            body=json.dumps(body).encode("utf-8"),
        )
    # See SEER_ANOMALY_DETECTION_TIMEOUT in sentry.conf.server.py
    except (TimeoutError, MaxRetryError):
        logger.warning(
            "Timeout error when hitting Seer store data endpoint",
            extra={
                "rule_id": alert_rule.id,
                "project_id": project.id,
            },
        )
        raise TimeoutError

    if response.status > 400:
        logger.error(
            "Error when hitting Seer store data endpoint",
            extra={"response_code": response.status},
        )
        raise Exception("Error when hitting Seer store data endpoint")

    try:
        decoded_data = response.data.decode("utf-8")
    except AttributeError:
        data_format_error_string = "Seer store data response data is malformed"
        logger.exception(
            data_format_error_string,
            extra={
                "ad_config": anomaly_detection_config,
                "alert": alert_rule.id,
                "response_data": response.data,
                "reponse_code": response.status,
            },
        )
        raise AttributeError(data_format_error_string)

    try:
        results: StoreDataResponse = json.loads(decoded_data)
    except JSONDecodeError:
        parse_error_string = "Failed to parse Seer store data response"
        logger.exception(
            parse_error_string,
            extra={
                "ad_config": anomaly_detection_config,
                "alert": alert_rule.id,
                "response_data": response.data,
                "reponse_code": response.status,
                "dataset": snuba_query.dataset,
                "meta": json.dumps(historical_data.data.get("meta", {}).get("fields", {})),
            },
        )
        raise ParseError(parse_error_string)

    if not results.get("success"):
        message = results.get("message", "")
        logger.error(
            "Error when hitting Seer store data endpoint",
            extra={
                "rule_id": alert_rule.id,
                "project_id": project.id,
                "error_message": message,
            },
        )
        raise Exception(message)

    MIN_DAYS = 7
    data_start_index, data_end_index = _get_start_and_end_indices(formatted_data)
    if data_start_index == -1:
        return AlertRuleStatus.NOT_ENOUGH_DATA

    data_start_time = datetime.fromtimestamp(formatted_data[data_start_index]["timestamp"])
    data_end_time = datetime.fromtimestamp(formatted_data[data_end_index]["timestamp"])
    if data_end_time - data_start_time < timedelta(days=MIN_DAYS):
        return AlertRuleStatus.NOT_ENOUGH_DATA
    return AlertRuleStatus.PENDING
