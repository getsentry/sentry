import logging
from datetime import datetime, timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.conf.server import SEER_ANOMALY_DETECTION_STORE_DATA_URL
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleStatus
from sentry.models.project import Project
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


def _get_start_and_end_indices(data: SnubaTSResult) -> tuple[int, int]:
    """
    Helper to return the first and last data points that have event counts.
    Used to determine whether we have at least a week's worth of data.
    """
    start, end = -1, -1
    indices_with_results = []
    for i, datum in enumerate(data.data.get("data", [])):
        if "count" in datum:
            indices_with_results.append(i)
    if not indices_with_results:
        return start, end
    else:
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
    historical_data = fetch_historical_data(alert_rule, snuba_query, project)

    if not historical_data:
        raise ValidationError("No historical data available.")

    formatted_data = format_historical_data(historical_data)
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
    try:
        make_signed_seer_api_request(
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

    MIN_DAYS = 7
    data_start_index, data_end_index = _get_start_and_end_indices(historical_data)
    if data_start_index == -1:
        return AlertRuleStatus.NOT_ENOUGH_DATA

    data_start_time = datetime.fromtimestamp(formatted_data[data_start_index]["timestamp"])
    data_end_time = datetime.fromtimestamp(formatted_data[data_end_index]["timestamp"])
    if data_end_time - data_start_time < timedelta(days=MIN_DAYS):
        return AlertRuleStatus.NOT_ENOUGH_DATA
    return AlertRuleStatus.PENDING


def fetch_historical_data(
    alert_rule: AlertRule, snuba_query: SnubaQuery, project: Project
) -> SnubaTSResult | None:
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

    if not project or not dataset or not alert_rule.organization:
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
