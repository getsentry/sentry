import logging

from django.conf import settings
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.conf.server import SEER_ANOMALY_DETECTION_MODEL_VERSION
from sentry.incidents.models.alert_rule import AlertRule
from sentry.net.http import connection_from_url
from sentry.seer.anomaly_detection.types import (
    AlertInSeer,
    DataSourceType,
    GetAlertThresholdDataRequest,
    GetAlertThresholdDataResponse,
)
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.utils import json

logger = logging.getLogger(__name__)

seer_anomaly_detection_connection_pool = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL,
    timeout=settings.SEER_HISTORICAL_ANOMALY_DETECTION_TIMEOUT,
)


def get_alert_threshold_data_from_seer(
    alert_rule: AlertRule, start: float, end: float
) -> GetAlertThresholdDataResponse | None:
    """
    Fetch threshold data (yhat_lower, yhat_upper) for an alert rule from Seer.

    This endpoint returns the model's predicted thresholds that determine when
    a data point is considered anomalous. Used to visualize thresholds on charts.
    """
    if not alert_rule.snuba_query:
        logger.error(
            "No snuba query associated with alert rule",
            extra={"alert_rule_id": alert_rule.id},
        )
        return None

    subscription = alert_rule.snuba_query.subscriptions.first()
    if not subscription:
        logger.error(
            "No subscription associated with alert rule",
            extra={
                "alert_rule_id": alert_rule.id,
                "snuba_query_id": alert_rule.snuba_query_id,
            },
        )
        return None

    alert_context = AlertInSeer(
        id=None,
        source_id=subscription.id,
        source_type=DataSourceType.SNUBA_QUERY_SUBSCRIPTION,
    )

    body = GetAlertThresholdDataRequest(
        alert=alert_context,
        start=start,
        end=end,
    )

    extra_data = {
        "alert_rule_id": alert_rule.id,
        "subscription_id": subscription.id,
        "organization_id": alert_rule.organization_id,
        "project_id": (
            alert_rule.snuba_query.subscriptions.first().project_id
            if alert_rule.snuba_query.subscriptions.first()
            else None
        ),
        "start": start,
        "end": end,
    }

    try:
        response = make_signed_seer_api_request(
            seer_anomaly_detection_connection_pool,
            f"/{SEER_ANOMALY_DETECTION_MODEL_VERSION}/anomaly-detection/alert-data",
            json.dumps(body).encode("utf-8"),
        )
    except (TimeoutError, MaxRetryError):
        logger.exception(
            "Timeout error when hitting Seer alert threshold data endpoint",
            extra=extra_data,
        )
        return None

    if response.status != 200:
        logger.error(
            "Received non-200 status when calling Seer alert threshold data endpoint",
            extra={
                **extra_data,
                "response_status": response.status,
                "response_data": response.data,
            },
        )
        return None

    try:
        results: GetAlertThresholdDataResponse = json.loads(response.data.decode("utf-8"))

        if not results.get("success"):
            logger.error(
                "Seer alert threshold data endpoint returned failure",
                extra={**extra_data, "response_message": results.get("message")},
            )
            return None

        return results

    except (AttributeError, UnicodeError, json.JSONDecodeError):
        logger.exception(
            "Failed to parse Seer alert threshold data response",
            extra={**extra_data, "response_data": response.data},
        )
        return None
