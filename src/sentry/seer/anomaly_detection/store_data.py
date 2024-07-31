import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from urllib3 import BaseHTTPResponse
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry import features
from sentry.conf.server import SEER_ANOMALY_DETECTION_STORE_DATA_URL
from sentry.incidents.models.alert_rule import AlertRule
from sentry.net.http import connection_from_url
from sentry.seer.anomaly_detection.types import (
    AlertInSeer,
    AnomalyDetectionConfig,
    StoreDataRequest,
    TimeSeriesPoint,
)
from sentry.seer.anomaly_detection.utils import translate_direction
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.snuba.models import SnubaQuery
from sentry.snuba.referrer import Referrer
from sentry.snuba.utils import get_dataset
from sentry.users.models.user import User
from sentry.utils import json
from sentry.utils.snuba import SnubaTSResult

logger = logging.getLogger(__name__)

seer_anomaly_detection_connection_pool = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL,
    timeout=settings.SEER_ANOMALY_DETECTION_TIMEOUT,
)


def format_historical_data(data: SnubaTSResult) -> list[TimeSeriesPoint]:
    """
    Format Snuba data into the format the Seer API expects.
    If there are no results, it's just the timestamp
    {'time': 1719012000}, {'time': 1719018000}, {'time': 1719024000}

    If there are results, the count is added
    {'time': 1721300400, 'count': 2}
    """
    formatted_data = []
    for datum in data.data.get("data", []):
        ts_point = TimeSeriesPoint(timestamp=datum.get("time"), value=datum.get("count", 0))
        formatted_data.append(ts_point)
    return formatted_data


def send_historical_data_to_seer(alert_rule: AlertRule, user: User) -> BaseHTTPResponse:
    """
    Get 28 days of historical data and pass it to Seer to be used for prediction anomalies on the alert
    """
    base_error_response = BaseHTTPResponse(
        status=status.HTTP_400_BAD_REQUEST,
        reason="Something went wrong!",
        version=0,
        version_string="HTTP/?",
        decode_content=True,
        request_url=SEER_ANOMALY_DETECTION_STORE_DATA_URL,
    )
    if not features.has(
        "organizations:anomaly-detection-alerts", alert_rule.organization, actor=user
    ):
        base_error_response.reason = "You do not have the anomaly detection alerts feature enabled."
        return base_error_response

    project = alert_rule.projects.get()
    if not project:
        logger.error(
            "No project associated with alert_rule. Skipping sending historical data to Seer",
            extra={
                "rule_id": alert_rule.id,
            },
        )
        base_error_response.reason = (
            "No project associated with alert_rule. Cannot create alert_rule."
        )
        return base_error_response

    snuba_query = SnubaQuery.objects.get(id=alert_rule.snuba_query_id)
    window_min = int(snuba_query.time_window / 60)
    historical_data = fetch_historical_data(alert_rule, snuba_query)

    if not historical_data:
        base_error_response.reason = "No historical data available. Cannot create alert_rule."
        return base_error_response

    formatted_data = format_historical_data(historical_data)

    if (
        not alert_rule.sensitivity
        or not alert_rule.seasonality
        or alert_rule.threshold_type is None
    ):
        # this won't happen because we've already gone through the serializer, but mypy insists
        base_error_response.reason = (
            "Cannot create alert_rule - missing expected configuration for a dynamic alert."
        )
        return base_error_response

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
    try:
        resp = make_signed_seer_api_request(
            connection_pool=seer_anomaly_detection_connection_pool,
            path=SEER_ANOMALY_DETECTION_STORE_DATA_URL,
            body=json.dumps(body).encode("utf-8"),
        )
    # See SEER_ANOMALY_DETECTION_TIMEOUT in sentry.conf.server.py
    except (TimeoutError, MaxRetryError):
        timeout_text = "Timeout error when hitting Seer store data endpoint"
        logger.warning(
            timeout_text,
            extra={
                "rule_id": alert_rule.id,
                "project_id": project.id,
            },
        )
        base_error_response.reason = timeout_text
        base_error_response.status = status.HTTP_408_REQUEST_TIMEOUT
        return base_error_response

    # TODO warn if there isn't at least 7 days of data
    return resp


def fetch_historical_data(alert_rule: AlertRule, snuba_query: SnubaQuery) -> SnubaTSResult | None:
    """
    Fetch 28 days of historical data from Snuba to pass to Seer to build the anomaly detection model
    """
    # TODO: if we can pass the existing timeseries data we have on the front end along here, we can shorten
    # the time period we query and combine the data
    NUM_DAYS = 28
    end = timezone.now()
    start = end - timedelta(days=NUM_DAYS)
    granularity = snuba_query.time_window

    dataset_label = snuba_query.dataset
    if dataset_label == "events":
        # DATSET_OPTIONS expects the name 'errors'
        dataset_label = "errors"
    dataset = get_dataset(dataset_label)
    project = alert_rule.projects.get()
    if not project or not dataset:
        return None

    historical_data = dataset.timeseries_query(
        selected_columns=[snuba_query.aggregate],
        query=snuba_query.query,
        params={
            "organization_id": alert_rule.organization.id,
            "project_id": [project.id],
            "granularity": granularity,
            "start": start,
            "end": end,
        },
        rollup=granularity,
        referrer=Referrer.ANOMALY_DETECTION_HISTORICAL_DATA_QUERY.value,
        zerofill_results=True,
    )
    return historical_data
