from rest_framework.exceptions import APIException
from rest_framework.status import HTTP_410_GONE

from sentry import features
from sentry.models.organization import Organization
from sentry.utils import metrics


class AlertsApiGone(APIException):
    status_code = HTTP_410_GONE
    default_detail = "This API no longer exists."


def enforce_alerts_api_deprecation(organization: Organization) -> None:
    blocked = not features.has("organizations:legacy-alerts-api", organization)
    metrics.incr(
        "workflow_engine.legacy_alerts_api_deprecation",
        tags={"blocked": blocked},
        sample_rate=1.0,
    )
    if blocked:
        raise AlertsApiGone
