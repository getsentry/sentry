import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from urllib3 import BaseHTTPResponse
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry import features
from sentry.conf.server import SEER_ANOMALY_DETECTION_STORE_DATA_URL
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleThresholdType
from sentry.models.user import User
from sentry.net.http import connection_from_url
from sentry.seer.anomaly_detection.types import ADConfig, Alert, StoreDataRequest, TimeSeriesPoint
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
        ts_point = TimeSeriesPoint(timestamp=datum.get("time"))
        if datum.get("count"):
            ts_point["value"] = datum.get("count")
        else:
            ts_point["value"] = 0

        formatted_data.append(ts_point)
    return formatted_data


def is_data_empty(data: list[TimeSeriesPoint]) -> bool:
    for datum in data:
        if datum.get("value") != 0:
            return False
    return True


def translate_direction(direction: int) -> str:
    """
    Temporary translation map to Seer's expected values
    """
    direction_map = {
        AlertRuleThresholdType.ABOVE: "up",
        AlertRuleThresholdType.BELOW: "down",
        AlertRuleThresholdType.ABOVE_AND_BELOW: "both",
    }
    return direction_map[AlertRuleThresholdType(direction)]


def get_project_id_from_rule(rule: AlertRule) -> int | None:
    project = None
    subscriptions = rule.snuba_query.subscriptions.all()
    if subscriptions:
        project = subscriptions[0].project

        if not project:
            return None
    return project.id


def send_historical_data_to_seer(rule: AlertRule, user: User) -> None:
    if not features.has("organizations:anomaly-detection-alerts", rule.organization, actor=user):
        return None

    project_id = get_project_id_from_rule(rule)
    if not project_id:
        logger.error(
            "No project associated with rule. Skipping sending historical data to Seer",
            extra={
                "rule_id": rule.id,
                "project_id": project_id,
            },
        )
        return None
    snuba_query = SnubaQuery.objects.get(id=rule.snuba_query_id)
    time_period = int(snuba_query.time_window / 60)
    historical_data = fetch_historical_data(rule, snuba_query)
    formatted_data = format_historical_data(historical_data)

    if is_data_empty(formatted_data):
        return BaseHTTPResponse(
            status=status.HTTP_400_BAD_REQUEST,
            reason="No historical data available. Cannot make anomaly detection rule.",
            version=0,
            version_string="HTTP/?",
            decode_content=True,
            request_url=SEER_ANOMALY_DETECTION_STORE_DATA_URL,
        )

    # TODO: handle case where we have some historical data but it's less than 7 days
    # need to add something to the response that the front end can render to let the user know it won't work for x num of days

    ad_config = ADConfig(
        time_period=time_period,
        sensitivity=rule.sensitivity,
        direction=translate_direction(rule.threshold_type),
        expected_seasonality=rule.seasonality,
    )
    alert = Alert(id=rule.id)
    body = StoreDataRequest(
        organization_id=rule.organization.id,
        project_id=project_id,
        alert=alert,
        config=ad_config,
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
        logger.warning(
            "Timeout error when hitting Seer store data endpoint",
            extra={
                "rule_id": rule.id,
                "project_id": project_id,
            },
        )
    return resp


def fetch_historical_data(rule: AlertRule, snuba_query: SnubaQuery) -> SnubaTSResult | None:
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
    project_id = get_project_id_from_rule(rule)
    if not project_id:
        return None

    historical_data = dataset.timeseries_query(
        selected_columns=[snuba_query.aggregate],
        query=snuba_query.query,
        params={
            "organization_id": rule.organization.id,
            "project_id": [project_id],
            "granularity": granularity,
            "start": start,
            "end": end,
        },
        rollup=granularity,
        referrer=Referrer.ANOMALY_DETECTION_HISTORICAL_DATA_QUERY.value,
        zerofill_results=True,
    )
    return historical_data
