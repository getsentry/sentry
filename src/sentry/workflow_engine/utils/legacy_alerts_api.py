from rest_framework.exceptions import APIException
from rest_framework.status import HTTP_410_GONE

from sentry import features
from sentry.models.organization import Organization


class AlertsApiGone(APIException):
    status_code = HTTP_410_GONE
    default_detail = "This API no longer exists."


def enforce_alerts_api_deprecation(organization: Organization) -> None:
    if not features.has("organizations:legacy-alerts-api", organization):
        raise AlertsApiGone
