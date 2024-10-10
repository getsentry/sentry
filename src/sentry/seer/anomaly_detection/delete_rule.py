import logging
from typing import TYPE_CHECKING, cast

from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.conf.server import SEER_ALERT_DELETION_URL
from sentry.models.organization import Organization
from sentry.seer.anomaly_detection.types import DeleteAlertDataRequest
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.utils import json
from sentry.utils.json import JSONDecodeError

logger = logging.getLogger(__name__)


if TYPE_CHECKING:
    from sentry.incidents.models.alert_rule import AlertRule


def delete_rule_in_seer(alert_rule: "AlertRule") -> bool:
    """
    Send a request to delete an alert rule from Seer. Returns True if the request was successful.
    """
    from sentry.seer.anomaly_detection.utils import SEER_ANOMALY_DETECTION_CONNECTION_POOL

    body = DeleteAlertDataRequest(
        organization_id=cast(Organization, alert_rule.organization).id,
        alert={"id": alert_rule.id},
    )
    extra_data = {
        "rule_id": alert_rule.id,
    }

    try:
        response = make_signed_seer_api_request(
            connection_pool=SEER_ANOMALY_DETECTION_CONNECTION_POOL,
            path=SEER_ALERT_DELETION_URL,
            body=json.dumps(body).encode("utf-8"),
        )
    except (TimeoutError, MaxRetryError):
        logger.warning(
            "Timeout error when hitting Seer delete rule data endpoint",
            extra=extra_data,
        )
        return False

    if response.status > 400:
        logger.error(
            "Error when hitting Seer delete rule data endpoint",
            extra={
                "response_data": response.data,
                **extra_data,
            },
        )
        return False

    try:
        decoded_data = response.data.decode("utf-8")
    except AttributeError:
        logger.exception(
            "Failed to parse Seer delete rule data response",
            extra=extra_data,
        )
        return False

    try:
        results = json.loads(decoded_data)
    except JSONDecodeError:
        logger.exception(
            "Failed to parse Seer delete rule data response",
            extra=extra_data,
        )
        return False

    status = results.get("success")
    if status is None or status is not True:
        logger.error(
            "Request to delete alert rule from Seer was unsuccessful",
            extra=extra_data,
        )
        return False

    return True
