import logging

from django.conf import settings
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.conf.server import SEER_ANOMALY_DETECTION_ALERT_DATA_URL
from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.utils import json
from sentry.utils.json import JSONDecodeError

logger = logging.getLogger(__name__)

seer_anomaly_detection_connection_pool = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL,
    timeout=settings.SEER_ANOMALY_DETECTION_TIMEOUT,
)


def get_alert_data_from_seer(
    alert_rule_id: int, start: float, end: float
) -> list[dict[str, object]] | None:
    """
    Get anomaly detection threshold data from Seer for a specific alert rule and time range.
    Returns data points with yhat_lower and yhat_upper threshold values.
    """
    body = {
        "alert": {
            "id": None,
            "source_id": alert_rule_id,
            "source_type": 1,
        },
        "start": start,
        "end": end,
    }

    extra_data = {
        "alert_rule_id": alert_rule_id,
        "start": start,
        "end": end,
    }

    try:
        response = make_signed_seer_api_request(
            connection_pool=seer_anomaly_detection_connection_pool,
            path=SEER_ANOMALY_DETECTION_ALERT_DATA_URL,
            body=json.dumps(body).encode("utf-8"),
        )
    except (TimeoutError, MaxRetryError):
        logger.warning("Timeout error when hitting Seer alert-data endpoint", extra=extra_data)
        return None

    if response.status != 200:
        logger.error(
            "Received non-200 status when calling Seer alert-data endpoint",
            extra={
                "response_data": response.data,
                "response_status": response.status,
                **extra_data,
            },
        )
        return None

    try:
        decoded_data = response.data.decode("utf-8")
        results = json.loads(decoded_data)

        if not results.get("success"):
            logger.warning(
                "Seer alert-data endpoint returned unsuccessful response",
                extra={"response_data": results, **extra_data},
            )
            return None

        data = results.get("data")
        if not data:
            logger.warning(
                "Seer alert-data endpoint returned no data",
                extra={"response_data": results, **extra_data},
            )
            return None

        return data
    except (AttributeError, UnicodeError, JSONDecodeError):
        logger.exception(
            "Failed to parse Seer alert-data response",
            extra={"response_data": response.data, "response_code": response.status, **extra_data},
        )
        return None
