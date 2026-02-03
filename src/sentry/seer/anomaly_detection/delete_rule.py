from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from django.conf import settings
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.conf.server import SEER_ALERT_DELETION_URL
from sentry.models.organization import Organization
from sentry.net.http import connection_from_url
from sentry.seer.anomaly_detection.types import AlertInSeer, DataSourceType, DeleteAlertDataRequest
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.utils import json
from sentry.utils.json import JSONDecodeError

logger = logging.getLogger(__name__)

seer_anomaly_detection_connection_pool = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL, timeout=settings.SEER_DEFAULT_TIMEOUT
)

if TYPE_CHECKING:
    from sentry.workflow_engine.models.detector import Detector


def delete_data_in_seer_for_detector(detector: Detector):
    from sentry.incidents.models.alert_rule import AlertRuleDetectionType
    from sentry.workflow_engine.models import DataSourceDetector

    data_source_detector = DataSourceDetector.objects.filter(detector_id=detector.id).first()
    if not data_source_detector:
        logger.error(
            "No data source found for detector",
            extra={
                "detector_id": detector.id,
            },
        )
        return

    organization = detector.project.organization

    if detector.config.get("detection_type") == AlertRuleDetectionType.DYNAMIC:
        success = delete_rule_in_seer(
            source_id=int(data_source_detector.data_source.source_id), organization=organization
        )
        if not success:
            logger.error(
                "Call to delete rule data in Seer failed",
                extra={
                    "detector_id": detector.id,
                },
            )


def delete_rule_in_seer(source_id: int, organization: Organization) -> bool:
    """
    Send a request to delete an alert rule from Seer. Returns True if the request was successful.
    """
    body = DeleteAlertDataRequest(
        organization_id=organization.id,
        alert=AlertInSeer(
            id=None, source_id=source_id, source_type=DataSourceType.SNUBA_QUERY_SUBSCRIPTION
        ),
    )
    extra_data = {
        "source_id": source_id,
    }
    try:
        response = make_signed_seer_api_request(
            connection_pool=seer_anomaly_detection_connection_pool,
            path=SEER_ALERT_DELETION_URL,
            body=json.dumps(body).encode("utf-8"),
        )
    except (TimeoutError, MaxRetryError):
        logger.warning(
            "Timeout error when hitting Seer delete rule data endpoint",
            extra=extra_data,
        )
        return False

    if response.status >= 400:
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
    if status is None:
        logger.error(
            "Request to delete alert rule from Seer was unsuccessful",
            extra=extra_data,
        )
        return False
    elif status is not True:
        extra_data["message"] = results.get("message")
        logger.error(
            "Request to delete alert rule from Seer was unsuccessful",
            extra=extra_data,
        )
        return False

    return True
