import logging
from datetime import datetime, timedelta

from django.conf import settings
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.api.bases.organization_events import get_query_columns
from sentry.conf.server import SEER_ANOMALY_DETECTION_ENDPOINT_URL
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleStatus
from sentry.models.project import Project
from sentry.net.http import connection_from_url
from sentry.seer.anomaly_detection.store_data import _get_start_index
from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionConfig,
    DetectAnomaliesRequest,
    DetectAnomaliesResponse,
    DetectHistoricalAnomaliesContext,
    DetectHistoricalAnomaliesRequest,
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
        extra_data = {"message": results.get("message", "")}
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
    data_start_index = _get_start_index(historical_data)
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
        )
    except (TimeoutError, MaxRetryError):
        logger.warning("Timeout error when hitting anomaly detection endpoint", extra=extra_data)
        return None

    error = handle_seer_error_responses(response, config, context, extra_data)
    if error:
        return None

    results: DetectAnomaliesResponse = json.loads(response.data.decode("utf-8"))
    return results.get("timeseries")


def get_historical_anomaly_data_from_seer(
    alert_rule: AlertRule, project: Project, start_string: str, end_string: str
) -> list | None:
    """
    Send time series data to Seer and return anomaly detection response.
    """
    if alert_rule.status == AlertRuleStatus.NOT_ENOUGH_DATA.value:
        return []
    # don't think these can happen but mypy is yelling
    if not alert_rule.snuba_query:
        logger.error(
            "No snuba query associated with alert rule",
            extra={
                "alert_rule_id": alert_rule.id,
            },
        )
        return None
    if not alert_rule.organization:
        logger.error(
            "No organization associated with alert rule",
            extra={
                "alert_rule_id": alert_rule.id,
            },
        )
        return None
    subscription = alert_rule.snuba_query.subscriptions.first()
    # same deal as above
    if not subscription:
        logger.error(
            "No subscription associated with alert rule",
            extra={"alert_rule_id": alert_rule.id, "snuba_query_id": alert_rule.snuba_query_id},
        )
        return None
    snuba_query = SnubaQuery.objects.get(id=alert_rule.snuba_query_id)
    dataset = get_dataset(snuba_query.dataset)
    window_min = int(snuba_query.time_window / 60)
    start = datetime.fromisoformat(start_string)
    end = datetime.fromisoformat(end_string)
    query_columns = get_query_columns([snuba_query.aggregate], snuba_query.time_window)
    historical_data = fetch_historical_data(
        organization=alert_rule.organization,
        snuba_query=snuba_query,
        query_columns=query_columns,
        project=project,
        start=start,
        end=end,
    )

    if not historical_data:
        logger.error(
            "No historical data available",
            extra={
                "alert_rule_id": alert_rule.id,
                "snuba_query_id": alert_rule.snuba_query_id,
                "project_id": project.id,
                "start": start,
                "end": end,
            },
        )
        return None
    formatted_data = format_historical_data(
        data=historical_data,
        query_columns=query_columns,
        dataset=dataset,
        organization=project.organization,
    )
    if (
        not alert_rule.sensitivity
        or not alert_rule.seasonality
        or alert_rule.threshold_type is None
        or alert_rule.organization is None
    ):
        # this won't happen because we've already gone through the serializer, but mypy insists
        logger.error("Missing required configuration for an anomaly detection alert")
        return None

    anomaly_detection_config = AnomalyDetectionConfig(
        time_period=window_min,
        sensitivity=alert_rule.sensitivity,
        direction=translate_direction(alert_rule.threshold_type),
        expected_seasonality=alert_rule.seasonality,
    )
    body = DetectAnomaliesRequest(
        organization_id=alert_rule.organization.id,
        project_id=project.id,
        config=anomaly_detection_config,
        context=formatted_data,
    )
    try:
        response = make_signed_seer_api_request(
            seer_anomaly_detection_connection_pool,
            SEER_ANOMALY_DETECTION_ENDPOINT_URL,
            json.dumps(body).encode("utf-8"),
        )
    except (TimeoutError, MaxRetryError):
        logger.exception(
            "Timeout error when hitting anomaly detection endpoint",
            extra={
                "subscription_id": subscription.id,
                "dataset": alert_rule.snuba_query.dataset,
                "organization_id": alert_rule.organization.id,
                "project_id": project.id,
                "alert_rule_id": alert_rule.id,
            },
        )
        return None

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
                    "context": formatted_data,
                    "response_data": response.data,
                    "response_code": response.status,
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
                "context": formatted_data,
                "response_data": response.data,
                "response_code": response.status,
            },
        )
        return None
