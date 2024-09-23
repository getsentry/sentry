import logging
from datetime import datetime

from django.conf import settings
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.conf.server import SEER_ANOMALY_DETECTION_ENDPOINT_URL
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleStatus
from sentry.models.project import Project
from sentry.net.http import connection_from_url
from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionConfig,
    DetectAnomaliesRequest,
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


def get_historical_anomaly_data_from_seer_preview(
    current_data: list[TimeSeriesPoint],
    historical_data: list[TimeSeriesPoint],
    project_id: int,
    config: AnomalyDetectionConfig,
) -> list | None:
    """
    Send current and historical timeseries data to Seer and return anomaly detection response on the current timeseries.

    Dummy function. TODO: write out the Seer request logic.
    """
    return [
        {
            "anomaly": {"anomaly_score": -0.38810767243044786, "anomaly_type": "none"},
            "timestamp": 169,
            "value": 0.048480431,
        },
        {
            "anomaly": {"anomaly_score": -0.3890542800124323, "anomaly_type": "none"},
            "timestamp": 170,
            "value": 0.047910238,
        },
    ]


def get_historical_anomaly_data_from_seer(
    alert_rule: AlertRule, project: Project, start_string: str, end_string: str
) -> list | None:
    """
    Send time series data to Seer and return anomaly detection response.
    """
    if alert_rule.status == AlertRuleStatus.NOT_ENOUGH_DATA.value:
        return []
    # don't think this can happen but mypy is yelling
    if not alert_rule.snuba_query:
        logger.error(
            "No snuba query associated with alert rule",
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
    historical_data = fetch_historical_data(
        alert_rule=alert_rule, snuba_query=snuba_query, project=project, start=start, end=end
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
    formatted_data = format_historical_data(historical_data, dataset)
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
                    "reponse_code": response.status,
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
                "reponse_code": response.status,
            },
        )
        return None
