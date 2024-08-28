import logging

from django.conf import settings
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.conf.server import SEER_ANOMALY_DETECTION_ENDPOINT_URL
from sentry.net.http import connection_from_url
from sentry.seer.anomaly_detection.utils import translate_direction
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.utils import json, metrics, redis
from sentry.utils.json import JSONDecodeError

logger = logging.getLogger(__name__)

seer_anomaly_detection_connection_pool = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL,
    timeout=settings.SEER_ANOMALY_DETECTION_TIMEOUT,
)


def get_anomaly_data_from_seer(alert_rule, aggregation_value: float | None):
    try:
        subscription = alert_rule.snuba_query.subscriptions.first()

        anomaly_detection_config = {
            "time_period": alert_rule.snuba_query.time_window / 60,
            "sensitivity": alert_rule.sensitivity,
            "seasonality": alert_rule.seasonality,
            "direction": translate_direction(alert_rule.threshold_type),
        }

        context = {
            "id": alert_rule.id,
            "cur_window": {
                "timestamp": self.last_update,
                "value": aggregation_value,
            },
        }

        project = alert_rule.projects.first()
        response = make_signed_seer_api_request(
            seer_anomaly_detection_connection_pool,
            SEER_ANOMALY_DETECTION_ENDPOINT_URL,
            json.dumps(
                {
                    "organization_id": alert_rule.organization.id,
                    "project_id": project.id,
                    "config": anomaly_detection_config,
                    "context": context,
                }
            ).encode("utf-8"),
        )
    except (TimeoutError, MaxRetryError):
        logger.warning(
            "Timeout error when hitting anomaly detection endpoint",
            extra={
                "subscription_id": subscription.id,
                "dataset": subscription.snuba_query.dataset,
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
        results = json.loads(response.data.decode("utf-8")).get("anomalies")
        if not results:
            logger.warning(
                "Seer anomaly detection response returned no potential anomalies",
                extra={
                    "ad_config": anomaly_detection_config,
                    "context": context,
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
                "context": context,
                "response_data": response.data,
                "reponse_code": response.status,
            },
        )
        return None
